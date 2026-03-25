import { Router } from 'express';
import { getDb } from './db.js';
import { requireTelegramAdmin } from './telegramAuth.js';
import { fetchWbSalesAggregated, toAvgs } from './wbSales.js';

export const apiRouter = Router();

apiRouter.get('/me', requireTelegramAdmin, (req, res) => {
  res.json({
    ok: true,
    user: req.telegramUser,
    dev: process.env.DEV_SKIP_AUTH === '1',
  });
});

apiRouter.get('/dict', requireTelegramAdmin, (_req, res) => {
  const db = getDb();
  const employees = db.prepare('SELECT name, productivity_per_day FROM employees ORDER BY name').all() as {
    name: string;
    productivity_per_day: number;
  }[];
  const articles = db
    .prepare(
      'SELECT name, pay_per_unit, plan_fbs_per_day, wb_supplier_article, avg_daily_sales FROM articles ORDER BY name',
    )
    .all() as {
      name: string;
      pay_per_unit: number;
      plan_fbs_per_day: number;
      wb_supplier_article: string | null;
      avg_daily_sales: number | null;
    }[];

  res.json({ ok: true, employees, articles });
});

type Line = { articleName: string; qty: number };

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

  const artStmt = db.prepare(
    'SELECT name, pay_per_unit FROM articles WHERE name = ? OR wb_supplier_article = ?',
  );
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

apiRouter.post('/admin/import', requireTelegramAdmin, (req, res) => {
  const db = getDb();
  const employees = req.body?.employees as { name: string; productivity?: number }[] | undefined;
  const articles = req.body?.articles as
    | {
        name: string;
        payPerUnit?: number;
        planFbsPerDay?: number;
        wbSupplierArticle?: string;
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
    `INSERT INTO articles (name, pay_per_unit, plan_fbs_per_day, wb_supplier_article)
     VALUES (@name, @pay, @plan, @wb)
     ON CONFLICT(name) DO UPDATE SET
       pay_per_unit = excluded.pay_per_unit,
       plan_fbs_per_day = excluded.plan_fbs_per_day,
       wb_supplier_article = COALESCE(excluded.wb_supplier_article, articles.wb_supplier_article)`,
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
      });
    }
  });
  tx();

  res.json({ ok: true, employees: employees.length, articles: articles.length });
});

apiRouter.post('/admin/sync-wb-sales', requireTelegramAdmin, async (req, res) => {
  const token = process.env.WB_API_TOKEN || '';
  if (!token) {
    res.status(400).json({ ok: false, error: 'WB_API_TOKEN не задан' });
    return;
  }

  const lookback = Math.max(1, Number(process.env.WB_SALES_LOOKBACK_DAYS) || 21);

  try {
    const agg = await fetchWbSalesAggregated({ token, lookbackDays: lookback });
    const avgs = toAvgs(agg, lookback);
    const db = getDb();
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
