import { useCallback, useEffect, useState } from 'react';
import {
  apiGet, apiPost, apiPatch, apiDelete,
  Employee, Article, Assembly, Shipment, SalaryRow, ForecastDay, ArticleSummary, Stock,
} from './api';

type Screen = 'assembly' | 'records' | 'shipments' | 'articles' | 'dashboard' | 'settings';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(s: string) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('assembly');
  const [me, setMe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);

  const loadDict = useCallback(async () => {
    const d = await apiGet<{ employees: Employee[]; articles: Article[] }>('dict');
    setEmployees(d.employees);
    setArticles(d.articles);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const m = await apiGet<{ user?: { first_name?: string; id: number }; dev?: boolean }>('me');
        setMe(m.dev ? 'dev' : m.user?.first_name || `id ${m.user?.id}`);
        await loadDict();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [loadDict]);

  if (err && !me) {
    return <div className="app"><div className="card"><p className="err">{err}</p></div></div>;
  }

  return (
    <div className="app">
      {screen === 'assembly' && (
        <AssemblyScreen employees={employees} articles={articles} />
      )}
      {screen === 'records' && (
        <RecordsScreen employees={employees} articles={articles} onDictChange={loadDict} />
      )}
      {screen === 'shipments' && (
        <ShipmentsScreen articles={articles} />
      )}
      {screen === 'articles' && (
        <ArticlesSummaryScreen />
      )}
      {screen === 'dashboard' && (
        <DashboardScreen />
      )}
      {screen === 'settings' && (
        <SettingsScreen employees={employees} articles={articles} onDictChange={loadDict} />
      )}

      <nav className="nav">
        <NavItem icon={IconPlus} label="Сборка" active={screen === 'assembly'} onClick={() => setScreen('assembly')} />
        <NavItem icon={IconList} label="Записи" active={screen === 'records'} onClick={() => setScreen('records')} />
        <NavItem icon={IconTruck} label="Поставки" active={screen === 'shipments'} onClick={() => setScreen('shipments')} />
        <NavItem icon={IconBox} label="Артикулы" active={screen === 'articles'} onClick={() => setScreen('articles')} />
        <NavItem icon={IconChart} label="Отчёт" active={screen === 'dashboard'} onClick={() => setScreen('dashboard')} />
        <NavItem icon={IconGear} label="Настройки" active={screen === 'settings'} onClick={() => setScreen('settings')} />
      </nav>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: React.FC; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

function IconPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>;
}
function IconList() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
}
function IconTruck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
}
function IconBox() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>;
}
function IconChart() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>;
}
function IconGear() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
}

// ============== ASSEMBLY SCREEN ==============
function AssemblyScreen({ employees, articles }: { employees: Employee[]; articles: Article[] }) {
  const [date, setDate] = useState(todayISO);
  const [employee, setEmployee] = useState('');
  const [lines, setLines] = useState<{ articleName: string; qty: string }[]>([{ articleName: '', qty: '' }]);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (employees.length && !employee) setEmployee(employees[0].name);
  }, [employees, employee]);

  const submit = async () => {
    setLoading(true);
    setErr('');
    setOk('');
    try {
      const payload = {
        date,
        employeeName: employee,
        lines: lines.filter((l) => l.articleName && l.qty).map((l) => ({ articleName: l.articleName, qty: Number(l.qty) })),
      };
      if (!payload.lines.length) {
        setErr('Добавьте хотя бы одну строку');
        return;
      }
      const r = await apiPost<{ saved: number }>('assemblies', payload);
      setOk(`Сохранено: ${r.saved} шт`);
      setLines([{ articleName: '', qty: '' }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1>Ввод сборки</h1>
      {err && <p className="err">{err}</p>}
      {ok && <p className="ok">{ok}</p>}

      <div className="card">
        <label>Дата</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label>Сотрудник</label>
        <select value={employee} onChange={(e) => setEmployee(e.target.value)}>
          {employees.map((x) => (
            <option key={x.id} value={x.name}>{x.name}</option>
          ))}
        </select>

        <h2>Артикулы</h2>
        <div className="list">
          {lines.map((line, i) => (
            <div key={i} className="row2">
              <div>
                <select
                  value={line.articleName}
                  onChange={(e) => setLines((prev) => prev.map((p, j) => j === i ? { ...p, articleName: e.target.value } : p))}
                >
                  <option value="">Выберите артикул</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({a.pay_per_unit}₽)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Кол-во"
                  min={1}
                  value={line.qty}
                  onChange={(e) => setLines((prev) => prev.map((p, j) => j === i ? { ...p, qty: e.target.value } : p))}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="actions">
          <button className="secondary" onClick={() => setLines((prev) => [...prev, { articleName: '', qty: '' }])}>
            + Строка
          </button>
          <button disabled={loading} onClick={submit}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
}

// ============== RECORDS SCREEN ==============
function RecordsScreen({ employees, articles, onDictChange }: { employees: Employee[]; articles: Article[]; onDictChange: () => void }) {
  const [tab, setTab] = useState<'assemblies' | 'employees' | 'articles'>('assemblies');

  return (
    <>
      <h1>Записи и справочники</h1>
      <div className="tabs">
        <button className={`tab ${tab === 'assemblies' ? 'active' : ''}`} onClick={() => setTab('assemblies')}>Сборка</button>
        <button className={`tab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Сотрудники</button>
        <button className={`tab ${tab === 'articles' ? 'active' : ''}`} onClick={() => setTab('articles')}>Артикулы</button>
      </div>

      {tab === 'assemblies' && <AssembliesTab />}
      {tab === 'employees' && <EmployeesTab employees={employees} onChange={onDictChange} />}
      {tab === 'articles' && <ArticlesTab articles={articles} onChange={onDictChange} />}
    </>
  );
}

function AssembliesTab() {
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayISO);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ assemblies: Assembly[] }>(`assemblies?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setAssemblies(r.assemblies);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const toggleConfirm = async (id: number, current: number) => {
    await apiPatch(`assemblies/${id}/confirm`, { confirmed: !current });
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить запись?')) return;
    await apiDelete(`assemblies/${id}`);
    load();
  };

  return (
    <div className="card">
      <div className="row2" style={{ marginBottom: 12 }}>
        <div>
          <label>С</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label>По</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {loading && <p className="muted">Загрузка...</p>}

      {!loading && assemblies.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <p>Нет записей за период</p>
        </div>
      )}

      {!loading && assemblies.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Артикул</th>
                <th className="text-right">Кол-во</th>
                <th className="text-right">Сумма</th>
                <th className="text-center">✓</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assemblies.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.assembly_date)}</td>
                  <td>{a.employee_name}</td>
                  <td>{a.article_name}</td>
                  <td className="text-right">{a.qty}</td>
                  <td className="text-right">{a.amount?.toFixed(0)}₽</td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={!!a.confirmed}
                      onChange={() => toggleConfirm(a.id, a.confirmed)}
                    />
                  </td>
                  <td>
                    <button className="small danger" onClick={() => remove(a.id)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmployeesTab({ employees, onChange }: { employees: Employee[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [prod, setProd] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await apiPost('employees', { name: name.trim(), productivity_per_day: Number(prod) || 0 });
    setName('');
    setProd('');
    onChange();
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить сотрудника?')) return;
    await apiDelete(`employees/${id}`);
    onChange();
  };

  return (
    <div className="card">
      <div className="inline-form">
        <div>
          <label>Имя</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
        </div>
        <div style={{ width: 100 }}>
          <label>Произв.</label>
          <input type="number" value={prod} onChange={(e) => setProd(e.target.value)} placeholder="шт/день" />
        </div>
        <button onClick={add}>+</button>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {employees.map((e) => (
          <div key={e.id} className="list-item">
            <div className="list-item-main">
              <div className="list-item-title">{e.name}</div>
              <div className="list-item-sub">{e.productivity_per_day} шт/день</div>
            </div>
            <button className="small danger" onClick={() => remove(e.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticlesTab({ articles, onChange }: { articles: Article[]; onChange: () => void }) {
  const [name, setName] = useState('');
  const [pay, setPay] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await apiPost('articles', { name: name.trim(), pay_per_unit: Number(pay) || 0 });
    setName('');
    setPay('');
    onChange();
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить артикул?')) return;
    await apiDelete(`articles/${id}`);
    onChange();
  };

  return (
    <div className="card">
      <div className="inline-form">
        <div>
          <label>Артикул</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Код" />
        </div>
        <div style={{ width: 80 }}>
          <label>Оплата</label>
          <input type="number" value={pay} onChange={(e) => setPay(e.target.value)} placeholder="₽" />
        </div>
        <button onClick={add}>+</button>
      </div>

      <div className="list" style={{ marginTop: 12 }}>
        {articles.map((a) => (
          <div key={a.id} className="list-item">
            <div className="list-item-main">
              <div className="list-item-title">{a.name}</div>
              <div className="list-item-sub">
                {a.pay_per_unit}₽/шт
                {a.avg_daily_sales != null && ` • ~${a.avg_daily_sales.toFixed(0)} прод/день`}
              </div>
            </div>
            <button className="small danger" onClick={() => remove(a.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== ARTICLES SUMMARY SCREEN ==============
function ArticlesSummaryScreen() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [stockSyncLoading, setStockSyncLoading] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [artRes, stockRes] = await Promise.all([
        apiGet<{ articles: ArticleSummary[] }>('articles-summary'),
        apiGet<{ stocks: Stock[] }>('stocks'),
      ]);
      setArticles(artRes.articles);
      setStocks(stockRes.stocks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncSales = async () => {
    setSyncLoading(true);
    setErr('');
    setOk('');
    try {
      const r = await apiPost<{ articlesUpdated: number; lookbackDays: number }>('admin/sync-wb-sales');
      setOk(`Продажи: обновлено ${r.articlesUpdated} артикулов`);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncLoading(false);
    }
  };

  const syncStocks = async () => {
    setStockSyncLoading(true);
    setErr('');
    setOk('');
    try {
      const r = await apiPost<{ updated: number; total: number }>('admin/sync-wb-stocks');
      setOk(`Остатки: обновлено ${r.updated} записей`);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setStockSyncLoading(false);
    }
  };

  const getStocksForArticle = (name: string) => stocks.filter((s) => s.article_name === name);

  return (
    <>
      <h1>Артикулы</h1>
      {err && <p className="err">{err}</p>}
      {ok && <p className="ok">{ok}</p>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Синхронизация WB</span>
        </div>
        <div className="actions">
          <button className="secondary" disabled={syncLoading} onClick={syncSales}>
            {syncLoading ? 'Загрузка...' : 'Обновить продажи'}
          </button>
          <button disabled={stockSyncLoading} onClick={syncStocks}>
            {stockSyncLoading ? 'Загрузка...' : 'Обновить остатки'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">FBS / Продажи / Остатки</span>
        </div>

        {loading && <p className="muted">Загрузка...</p>}

        {!loading && articles.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p>Нет артикулов</p>
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div className="list">
            {articles.map((a) => {
              const artStocks = getStocksForArticle(a.name);
              const isExpanded = expanded === a.name;
              return (
                <div key={a.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', cursor: artStocks.length ? 'pointer' : 'default' }}
                    onClick={() => artStocks.length && setExpanded(isExpanded ? null : a.name)}
                  >
                    <div className="list-item-main">
                      <div className="list-item-title">{a.name}</div>
                      <div className="list-item-sub">
                        FBS: <strong>{a.plan_fbs_per_day}</strong>/день •
                        Продажи: <strong>{a.avg_daily_sales != null ? a.avg_daily_sales.toFixed(1) : '—'}</strong>/день •
                        Остаток: <strong>{a.total_stock}</strong> шт
                      </div>
                    </div>
                    {artStocks.length > 0 && (
                      <span style={{ color: 'var(--hint-color)', fontSize: 12 }}>{isExpanded ? '▼' : '▶'}</span>
                    )}
                  </div>

                  {isExpanded && artStocks.length > 0 && (
                    <div className="stock-details">
                      {artStocks.map((s, i) => (
                        <div key={i} className="stock-row">
                          <span className="muted">{s.warehouse_name}</span>
                          <span>{s.quantity} шт</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ============== SHIPMENTS SCREEN ==============
function ShipmentsScreen({ articles }: { articles: Article[] }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [type, setType] = useState('FBO');
  const [date, setDate] = useState(todayISO);
  const [article, setArticle] = useState('');
  const [qty, setQty] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ shipments: Shipment[] }>('shipments');
      setShipments(r.shipments);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!article || !qty) return;
    await apiPost('shipments', { shipment_type: type, shipment_date: date, article_name: article, qty: Number(qty) });
    setQty('');
    load();
  };

  const remove = async (id: number) => {
    if (!confirm('Удалить поставку?')) return;
    await apiDelete(`shipments/${id}`);
    load();
  };

  return (
    <>
      <h1>Поставки</h1>

      <div className="card">
        <div className="row3">
          <div>
            <label>Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="FBO">FBO</option>
              <option value="FBS">FBS</option>
            </select>
          </div>
          <div>
            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label>Кол-во</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="шт" />
          </div>
        </div>
        <div className="inline-form">
          <div>
            <label>Артикул</label>
            <select value={article} onChange={(e) => setArticle(e.target.value)}>
              <option value="">Выберите</option>
              {articles.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <button onClick={add}>Добавить</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Ближайшие поставки</span>
        </div>

        {loading && <p className="muted">Загрузка...</p>}

        {!loading && shipments.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🚚</div>
            <p>Нет запланированных поставок</p>
          </div>
        )}

        {!loading && shipments.length > 0 && (
          <div className="list">
            {shipments.map((s) => {
              const pct = s.qty > 0 ? Math.min(100, (s.collected / s.qty) * 100) : 0;
              const color = pct >= 100 ? 'success' : pct >= 50 ? 'warning' : 'danger';
              return (
                <div key={s.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <span className={`badge ${s.shipment_type === 'FBO' ? 'info' : 'warning'}`}>{s.shipment_type}</span>
                      <strong style={{ marginLeft: 8 }}>{s.article_name}</strong>
                    </div>
                    <button className="small danger" onClick={() => remove(s.id)}>✕</button>
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {formatDate(s.shipment_date)} • {s.collected}/{s.qty} шт
                  </div>
                  <div className="progress-bar">
                    <div className={`progress-bar-fill ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ============== DASHBOARD SCREEN ==============
function DashboardScreen() {
  const [tab, setTab] = useState<'salaries' | 'forecast'>('salaries');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayISO);
  const [salaries, setSalaries] = useState<SalaryRow[]>([]);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSalaries = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ salaries: SalaryRow[] }>(`dashboard?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setSalaries(r.salaries);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ days: ForecastDay[] }>('forecast');
      setForecast(r.days);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'salaries') loadSalaries();
    else loadForecast();
  }, [tab, loadSalaries, loadForecast]);

  const totalConfirmed = salaries.reduce((s, r) => s + r.confirmed_amount, 0);
  const totalPending = salaries.reduce((s, r) => s + r.pending_amount, 0);

  return (
    <>
      <h1>Отчёты</h1>
      <div className="tabs">
        <button className={`tab ${tab === 'salaries' ? 'active' : ''}`} onClick={() => setTab('salaries')}>Зарплаты</button>
        <button className={`tab ${tab === 'forecast' ? 'active' : ''}`} onClick={() => setTab('forecast')}>Прогноз</button>
      </div>

      {tab === 'salaries' && (
        <>
          <div className="card">
            <div className="row2">
              <div>
                <label>С</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label>По</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{totalConfirmed.toLocaleString()}₽</div>
              <div className="stat-label">К выплате</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{totalPending.toLocaleString()}₽</div>
              <div className="stat-label">Не подтв.</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            {loading && <p className="muted">Загрузка...</p>}
            {!loading && salaries.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <p>Нет данных за период</p>
              </div>
            )}
            {!loading && salaries.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Сотрудник</th>
                      <th className="text-right">Собрано</th>
                      <th className="text-right">Подтв.</th>
                      <th className="text-right">К выплате</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaries.map((r) => (
                      <tr key={r.employee_name}>
                        <td>{r.employee_name}</td>
                        <td className="text-right">{r.total_qty}</td>
                        <td className="text-right">{r.confirmed_qty}</td>
                        <td className="text-right">{r.confirmed_amount.toLocaleString()}₽</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'forecast' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Прогноз на 14 дней</span>
          </div>
          {loading && <p className="muted">Загрузка...</p>}
          {!loading && forecast.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th className="text-right">Можем</th>
                    <th className="text-right">Нужно</th>
                    <th className="text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((d) => {
                    const ok = d.canProduce >= d.needed;
                    return (
                      <tr key={d.date}>
                        <td>{formatDate(d.date)}</td>
                        <td className="text-right">{d.canProduce}</td>
                        <td className="text-right">{d.needed}</td>
                        <td className="text-center">
                          <span className={`badge ${ok ? 'success' : 'danger'}`}>{ok ? '✓' : '!'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ============== SETTINGS SCREEN ==============
function SettingsScreen({ employees, articles, onDictChange }: { employees: Employee[]; articles: Article[]; onDictChange: () => void }) {
  const [wbToken, setWbToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    apiGet<{ settings: Record<string, string> }>('settings').then((r) => {
      setWbToken(r.settings.wb_token || '');
    });
  }, []);

  const saveToken = async () => {
    setLoading(true);
    setErr('');
    setOk('');
    try {
      await apiPost('settings', { wb_token: wbToken });
      setOk('Токен сохранён');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const syncWb = async () => {
    setSyncLoading(true);
    setErr('');
    setOk('');
    try {
      const r = await apiPost<{ articlesUpdated: number; lookbackDays: number }>('admin/sync-wb-sales');
      setOk(`Обновлено артикулов: ${r.articlesUpdated} (за ${r.lookbackDays} дней)`);
      onDictChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <>
      <h1>Настройки</h1>
      {err && <p className="err">{err}</p>}
      {ok && <p className="ok">{ok}</p>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Wildberries API</span>
        </div>
        <label>Токен статистики</label>
        <input
          type="password"
          value={wbToken}
          onChange={(e) => setWbToken(e.target.value)}
          placeholder="eyJhbGciOi..."
        />
        <div className="actions">
          <button className="secondary" disabled={loading} onClick={saveToken}>
            {loading ? 'Сохранение...' : 'Сохранить токен'}
          </button>
          <button disabled={syncLoading || !wbToken} onClick={syncWb}>
            {syncLoading ? 'Синхронизация...' : 'Обновить продажи'}
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Токен из кабинета WB → Настройки → Доступ к API → Статистика
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Статистика</span>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{employees.length}</div>
            <div className="stat-label">Сотрудников</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{articles.length}</div>
            <div className="stat-label">Артикулов</div>
          </div>
        </div>
      </div>
    </>
  );
}
