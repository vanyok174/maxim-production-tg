import { Router } from 'express';
import { getDb } from './db.js';
import { requireTelegramAdmin } from './telegramAuth.js';
import { fetchWbSalesAggregated, toAvgs } from './wbSales.js';

export const apiRouter = Router();

// ============== AUTH ==============
apiRouter.get('/me', requireTelegramAdmin, (req, res) => {
  res.json({
    ok: true,
    user: req.telegramUser,
    dev: process.env.DEV_SKIP_AUTH === '1',
  });
});

// ============== SETTINGS ==============
apiRouter.get('/settings', requireTelegramAdmin, (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ ok: true, settings });
});

apiRouter.post('/settings', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const updates = req.body as Record<string, string>;
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  );
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string') stmt.run(k, v);
    }
  });
  tx();
  res.json({ ok: true });
});

// ============== DICTIONARIES ==============
apiRouter.get('/dict', requireTelegramAdmin, (_req, res) => {
  const db = getDb();
  const employees = db
    .prepare('SELECT id, name, productivity_per_day FROM employees ORDER BY name')
    .all() as { id: number; name: string; productivity_per_day: number }[];
  const articles = db
    .prepare(
      'SELECT id, name, pay_per_unit, plan_fbs_per_day, wb_supplier_article, avg_daily_sales FROM articles ORDER BY name',
    )
    .all() as {
      id: number;
      name: string;
      pay_per_unit: number;
      plan_fbs_per_day: number;
      wb_supplier_article: string | null;
      avg_daily_sales: number | null;
    }[];
  res.json({ ok: true, employees, articles });
});

apiRouter.post('/employees', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const { name, productivity_per_day } = req.body as { name?: string; productivity_per_day?: number };
  if (!name?.trim()) {
    res.status(400).json({ ok: false, error: 'Укажите имя' });
    return;
  }
  const stmt = db.prepare(
    `INSERT INTO employees (name, productivity_per_day) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET productivity_per_day = excluded.productivity_per_day, updated_at = datetime('now')`,
  );
  stmt.run(name.trim(), productivity_per_day || 0);
  res.json({ ok: true });
});

apiRouter.delete('/employees/:id', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

apiRouter.post('/articles', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const { name, pay_per_unit, plan_fbs_per_day, wb_supplier_article } = req.body as {
    name?: string;
    pay_per_unit?: number;
    plan_fbs_per_day?: number;
    wb_supplier_article?: string;
  };
  if (!name?.trim()) {
    res.status(400).json({ ok: false, error: 'Укажите артикул' });
    return;
  }
  const stmt = db.prepare(
    `INSERT INTO articles (name, pay_per_unit, plan_fbs_per_day, wb_supplier_article)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       pay_per_unit = excluded.pay_per_unit,
       plan_fbs_per_day = excluded.plan_fbs_per_day,
       wb_supplier_article = excluded.wb_supplier_article,
       updated_at = datetime('now')`,
  );
  stmt.run(name.trim(), pay_per_unit || 0, plan_fbs_per_day || 0, wb_supplier_article?.trim() || null);
  res.json({ ok: true });
});

apiRouter.delete('/articles/:id', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============== ASSEMBLIES ==============
type Line = { articleName: string; qty: number };

apiRouter.get('/assemblies', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const dateFrom = String(req.query.dateFrom || '').slice(0, 10) || '1970-01-01';
  const dateTo = String(req.query.dateTo || '').slice(0, 10) || '2100-01-01';
  const rows = db
    .prepare(
      `SELECT id, assembly_date, employee_name, article_name, qty, confirmed, pay_per_unit, amount, created_at
       FROM assemblies
       WHERE assembly_date >= ? AND assembly_date <= ?
       ORDER BY assembly_date DESC, id DESC
       LIMIT 500`,
    )
    .all(dateFrom, dateTo);
  res.json({ ok: true, assemblies: rows });
});

apiRouter.post('/assemblies', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const date = String(req.body?.date || '').slice(0, 10);
  const employeeName = String(req.body?.employeeName || '').trim();
  const lines = req.body?.lines as Line[] | undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ ok: false, error: 'Нужна дата YYYY-MM-DD' });
    return;
  }
  if (!employeeName) {
    res.status(400).json({ ok: false, error: 'Выберите сотрудника' });
    return;
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    res.status(400).json({ ok: false, error: 'Добавьте хотя бы одну строку' });
    return;
  }

  const emp = db.prepare('SELECT 1 FROM employees WHERE name = ?').get(employeeName);
  if (!emp) {
    res.status(400).json({ ok: false, error: 'Неизвестный сотрудник' });
    return;
  }

  const artStmt = db.prepare('SELECT name, pay_per_unit FROM articles WHERE name = ? OR wb_supplier_article = ?');
  const insert = db.prepare(
    `INSERT INTO assemblies (assembly_date, employee_name, article_name, qty, confirmed, pay_per_unit, amount, created_by_tg_id)
     VALUES (@assembly_date, @employee_name, @article_name, @qty, 0, @pay_per_unit, @amount, @created_by_tg_id)`,
  );

  const createdBy = req.telegramUser?.id ?? null;
  const toInsert: {
    assembly_date: string;
    employee_name: string;
    article_name: string;
    qty: number;
    pay_per_unit: number;
    amount: number;
    created_by_tg_id: number | null;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const articleName = String(lines[i]?.articleName || '').trim();
    const qty = Number(lines[i]?.qty);
    if (!articleName) {
      res.status(400).json({ ok: false, error: `Строка ${i + 1}: нет артикула` });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      res.status(400).json({ ok: false, error: `Строка ${i + 1}: неверное количество` });
      return;
    }
    const row = artStmt.get(articleName, articleName) as { name: string; pay_per_unit: number } | undefined;
    if (!row) {
      res.status(400).json({ ok: false, error: `Неизвестный артикул: ${articleName}` });
      return;
    }
    const pay = Number(row.pay_per_unit);
    toInsert.push({
      assembly_date: date,
      employee_name: employeeName,
      article_name: row.name,
      qty,
      pay_per_unit: pay,
      amount: qty * pay,
      created_by_tg_id: createdBy,
    });
  }

  const run = db.transaction(() => {
    for (const r of toInsert) insert.run(r);
  });
  run();

  res.json({ ok: true, saved: toInsert.length });
});

apiRouter.patch('/assemblies/:id/confirm', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const confirmed = req.body?.confirmed ? 1 : 0;
  db.prepare('UPDATE assemblies SET confirmed = ? WHERE id = ?').run(confirmed, req.params.id);
  res.json({ ok: true });
});

apiRouter.delete('/assemblies/:id', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM assemblies WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============== SHIPMENTS ==============
apiRouter.get('/shipments', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, shipment_type, shipment_date, article_name, qty, collected, status, created_at
       FROM shipments
       WHERE shipment_date >= date('now', '-30 days')
       ORDER BY shipment_date ASC, id ASC`,
    )
    .all();
  res.json({ ok: true, shipments: rows });
});

apiRouter.post('/shipments', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const { shipment_type, shipment_date, article_name, qty } = req.body as {
    shipment_type?: string;
    shipment_date?: string;
    article_name?: string;
    qty?: number;
  };

  if (!shipment_type || !['FBO', 'FBS'].includes(shipment_type)) {
    res.status(400).json({ ok: false, error: 'Тип: FBO или FBS' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shipment_date || '')) {
    res.status(400).json({ ok: false, error: 'Нужна дата' });
    return;
  }
  if (!article_name?.trim()) {
    res.status(400).json({ ok: false, error: 'Укажите артикул' });
    return;
  }
  if (!qty || qty <= 0) {
    res.status(400).json({ ok: false, error: 'Укажите количество' });
    return;
  }

  db.prepare(
    'INSERT INTO shipments (shipment_type, shipment_date, article_name, qty) VALUES (?, ?, ?, ?)',
  ).run(shipment_type, shipment_date, article_name.trim(), qty);
  res.json({ ok: true });
});

apiRouter.delete('/shipments/:id', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM shipments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============== SCHEDULE ==============
apiRouter.get('/schedule', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const month = String(req.query.month || '').slice(0, 7); // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ ok: false, error: 'Формат месяца: YYYY-MM' });
    return;
  }
  const rows = db
    .prepare(
      `SELECT employee_name, work_date, is_working
       FROM schedule
       WHERE work_date LIKE ?
       ORDER BY employee_name, work_date`,
    )
    .all(`${month}%`);
  res.json({ ok: true, schedule: rows });
});

apiRouter.post('/schedule', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const { employee_name, work_date, is_working } = req.body as {
    employee_name?: string;
    work_date?: string;
    is_working?: boolean;
  };

  if (!employee_name?.trim()) {
    res.status(400).json({ ok: false, error: 'Укажите сотрудника' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(work_date || '')) {
    res.status(400).json({ ok: false, error: 'Нужна дата' });
    return;
  }

  const stmt = db.prepare(
    `INSERT INTO schedule (employee_name, work_date, is_working)
     VALUES (?, ?, ?)
     ON CONFLICT(employee_name, work_date) DO UPDATE SET is_working = excluded.is_working`,
  );
  stmt.run(employee_name.trim(), work_date, is_working ? 1 : 0);
  res.json({ ok: true });
});

// ============== DASHBOARD ==============
apiRouter.get('/dashboard', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const dateFrom = String(req.query.dateFrom || '').slice(0, 10) || '1970-01-01';
  const dateTo = String(req.query.dateTo || '').slice(0, 10) || '2100-01-01';

  const salaries = db
    .prepare(
      `SELECT
         employee_name,
         SUM(qty) as total_qty,
         SUM(CASE WHEN confirmed = 1 THEN qty ELSE 0 END) as confirmed_qty,
         SUM(CASE WHEN confirmed = 1 THEN amount ELSE 0 END) as confirmed_amount,
         SUM(CASE WHEN confirmed = 0 THEN amount ELSE 0 END) as pending_amount
       FROM assemblies
       WHERE assembly_date >= ? AND assembly_date <= ?
       GROUP BY employee_name
       ORDER BY confirmed_amount DESC`,
    )
    .all(dateFrom, dateTo);

  const shipments = db
    .prepare(
      `SELECT s.id, s.shipment_type, s.shipment_date, s.article_name, s.qty,
              COALESCE(SUM(CASE WHEN a.confirmed = 1 THEN a.qty ELSE 0 END), 0) as collected
       FROM shipments s
       LEFT JOIN assemblies a ON a.article_name = s.article_name
         AND a.assembly_date <= s.shipment_date
         AND a.confirmed = 1
       WHERE s.shipment_date >= date('now')
       GROUP BY s.id
       ORDER BY s.shipment_date ASC
       LIMIT 20`,
    )
    .all();

  res.json({ ok: true, salaries, shipments });
});

// ============== FORECAST ==============
apiRouter.get('/forecast', requireTelegramAdmin, (_req, res) => {
  const db = getDb();

  const articles = db
    .prepare('SELECT name, avg_daily_sales, plan_fbs_per_day FROM articles WHERE avg_daily_sales > 0 OR plan_fbs_per_day > 0')
    .all() as { name: string; avg_daily_sales: number | null; plan_fbs_per_day: number }[];

  const employees = db.prepare('SELECT name, productivity_per_day FROM employees').all() as {
    name: string;
    productivity_per_day: number;
  }[];

  const totalProductivity = employees.reduce((sum, e) => sum + (e.productivity_per_day || 0), 0);

  const days: { date: string; canProduce: number; needed: number }[] = [];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const workingCount = db
      .prepare('SELECT COUNT(*) as cnt FROM schedule WHERE work_date = ? AND is_working = 1')
      .get(dateStr) as { cnt: number };
    const workersToday = workingCount?.cnt || employees.length;
    const avgProd = employees.length > 0 ? totalProductivity / employees.length : 0;
    const canProduce = workersToday * avgProd;

    let needed = 0;
    for (const art of articles) {
      needed += art.avg_daily_sales || art.plan_fbs_per_day || 0;
    }

    days.push({ date: dateStr, canProduce: Math.round(canProduce), needed: Math.round(needed) });
  }

  res.json({ ok: true, days, articles: articles.length, employees: employees.length });
});

// ============== WB SYNC ==============
apiRouter.post('/admin/sync-wb-sales', requireTelegramAdmin, async (_req, res) => {
  const db = getDb();
  const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'wb_token'").get() as { value: string } | undefined;
  const token = tokenRow?.value || process.env.WB_API_TOKEN || '';

  if (!token) {
    res.status(400).json({ ok: false, error: 'WB токен не задан (Настройки → WB токен)' });
    return;
  }

  const lookback = Math.max(1, Number(process.env.WB_SALES_LOOKBACK_DAYS) || 21);

  try {
    const agg = await fetchWbSalesAggregated({ token, lookbackDays: lookback });
    const avgs = toAvgs(agg, lookback);
    const byKey = new Map(avgs.map((a) => [a.key.trim().toLowerCase(), a]));

    const rows = db.prepare('SELECT id, name, wb_supplier_article FROM articles').all() as {
      id: number;
      name: string;
      wb_supplier_article: string | null;
    }[];

    const upd = db.prepare(
      `UPDATE articles SET avg_daily_sales = ?, wb_synced_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    );

    let updated = 0;
    for (const r of rows) {
      const k1 = (r.wb_supplier_article || '').trim().toLowerCase();
      const k2 = r.name.trim().toLowerCase();
      const a = byKey.get(k1) || byKey.get(k2);
      if (!a) continue;
      upd.run(a.avgPerDay, r.id);
      updated++;
    }

    res.json({ ok: true, lookbackDays: lookback, wbSkus: avgs.length, articlesUpdated: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(502).json({ ok: false, error: msg });
  }
});

// ============== IMPORT ==============
apiRouter.post('/admin/import', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const employees = req.body?.employees as { name: string; productivity?: number }[] | undefined;
  const articles = req.body?.articles as
    | {
        name: string;
        payPerUnit?: number;
        planFbsPerDay?: number;
        wbSupplierArticle?: string;
        avgDailySales?: number | null;
      }[]
    | undefined;

  if (!Array.isArray(employees) || !Array.isArray(articles)) {
    res.status(400).json({ ok: false, error: 'Ожидаются employees[] и articles[]' });
    return;
  }

  const upEmp = db.prepare(
    `INSERT INTO employees (name, productivity_per_day) VALUES (@name, @p)
     ON CONFLICT(name) DO UPDATE SET productivity_per_day = excluded.productivity_per_day`,
  );
  const upArt = db.prepare(
    `INSERT INTO articles (name, pay_per_unit, plan_fbs_per_day, wb_supplier_article, avg_daily_sales)
     VALUES (@name, @pay, @plan, @wb, @avg)
     ON CONFLICT(name) DO UPDATE SET
       pay_per_unit = excluded.pay_per_unit,
       plan_fbs_per_day = excluded.plan_fbs_per_day,
       wb_supplier_article = COALESCE(excluded.wb_supplier_article, articles.wb_supplier_article),
       avg_daily_sales = COALESCE(excluded.avg_daily_sales, articles.avg_daily_sales)`,
  );

  const tx = db.transaction(() => {
    for (const e of employees) {
      const name = String(e?.name || '').trim();
      if (!name) continue;
      upEmp.run({ name, p: Number(e.productivity) || 0 });
    }
    for (const a of articles) {
      const name = String(a?.name || '').trim();
      if (!name) continue;
      upArt.run({
        name,
        pay: Number(a.payPerUnit) || 0,
        plan: Number(a.planFbsPerDay) || 0,
        wb: a.wbSupplierArticle ? String(a.wbSupplierArticle).trim() : null,
        avg: typeof a.avgDailySales === 'number' ? a.avgDailySales : null,
      });
    }
  });
  tx();

  res.json({ ok: true, employees: employees.length, articles: articles.length });
});
