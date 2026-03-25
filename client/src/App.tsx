import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from './api';

type Employee = { name: string; productivity_per_day: number };
type Article = {
  name: string;
  pay_per_unit: number;
  plan_fbs_per_day: number;
  wb_supplier_article: string | null;
  avg_daily_sales: number | null;
};

type Line = { articleName: string; qty: string };

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [me, setMe] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [date, setDate] = useState(todayISO);
  const [employee, setEmployee] = useState('');
  const [lines, setLines] = useState<Line[]>([{ articleName: '', qty: '' }]);
  const [loading, setLoading] = useState(false);
  const [wbLoading, setWbLoading] = useState(false);

  const refreshDict = useCallback(async () => {
    const d = await apiGet<{ employees: Employee[]; articles: Article[] }>('dict');
    setEmployees(d.employees);
    setArticles(d.articles);
    return d;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const m = await apiGet<{ user?: { first_name?: string; id: number }; dev?: boolean }>('me');
        const label = m.dev ? 'режим разработки' : (m.user?.first_name ?? `id ${m.user?.id}`);
        setMe(label);
        const d = await refreshDict();
        setEmployee((prev) => prev || d.employees[0]?.name || '');
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [refreshDict]);

  const addLine = () => setLines((prev) => [...prev, { articleName: '', qty: '' }]);

  const syncWb = async () => {
    setWbLoading(true);
    setErr(null);
    setOk(null);
    try {
      const r = await apiPost<{ articlesUpdated: number; lookbackDays: number }>('admin/sync-wb-sales');
      setOk(`WB: обновлено артикулов: ${r.articlesUpdated} (окно ${r.lookbackDays} дн.)`);
      await refreshDict();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setWbLoading(false);
    }
  };

  const submit = async () => {
    setLoading(true);
    setErr(null);
    setOk(null);
    try {
      const payload = {
        date,
        employeeName: employee,
        lines: lines
          .filter((l) => l.articleName && l.qty)
          .map((l) => ({ articleName: l.articleName, qty: Number(l.qty) })),
      };
      if (!payload.lines.length) {
        setErr('Заполните строки артикул — количество');
        return;
      }
      const r = await apiPost<{ saved: number }>('assemblies', payload);
      setOk(`Сохранено записей: ${r.saved}`);
      setLines([{ articleName: '', qty: '' }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Учёт сборки</h1>
      {me && <p className="muted">Вход: {me}</p>}
      {err && <p className="err">{err}</p>}
      {ok && <p className="ok">{ok}</p>}

      <div className="card">
        <label>Средние продажи (Wildberries)</label>
        <p className="muted">
          Подтягивает statistics-api, пишет в «артикулы». Нужен WB_API_TOKEN на сервере.
        </p>
        <button type="button" className="secondary" disabled={wbLoading} onClick={() => void syncWb()}>
          {wbLoading ? '…' : 'Обновить средние продажи'}
        </button>
      </div>

      <div className="card">
        <label htmlFor="d">Дата сборки</label>
        <input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <label htmlFor="e">Сотрудник</label>
        <select id="e" value={employee} onChange={(e) => setEmployee(e.target.value)}>
          {employees.map((x) => (
            <option key={x.name} value={x.name}>
              {x.name} ({x.productivity_per_day} шт/день план)
            </option>
          ))}
        </select>

        <div className="rows" style={{ marginTop: 12 }}>
          {lines.map((line, i) => (
            <div key={i} className="row2">
              <div>
                <label>Артикул</label>
                <select
                  value={line.articleName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) => prev.map((p, j) => (j === i ? { ...p, articleName: v } : p)));
                  }}
                >
                  <option value="">—</option>
                  {articles.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                      {a.avg_daily_sales != null
                        ? ` (~${a.avg_daily_sales.toFixed(1)} шт/день)`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Кол-во</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={line.qty}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLines((prev) => prev.map((p, j) => (j === i ? { ...p, qty: v } : p)));
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="actions">
          <button type="button" className="secondary" onClick={addLine}>
            + Строка
          </button>
          <button type="button" disabled={loading} onClick={() => void submit()}>
            {loading ? 'Сохранение…' : 'Сохранить сборку'}
          </button>
        </div>
      </div>
    </div>
  );
}
