const initHeader = (): HeadersInit => {
  const raw = window.Telegram?.WebApp?.initData || '';
  return { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': raw };
};

const base = () => `${import.meta.env.BASE_URL}api`;

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}/${path}`, { headers: initHeader() });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function apiPost<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${base()}/${path}`, {
    method: 'POST',
    headers: initHeader(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function apiPatch<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${base()}/${path}`, {
    method: 'PATCH',
    headers: initHeader(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}/${path}`, {
    method: 'DELETE',
    headers: initHeader(),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export type Employee = { id: number; name: string; productivity_per_day: number };
export type Article = {
  id: number;
  name: string;
  pay_per_unit: number;
  plan_fbs_per_day: number;
  wb_supplier_article: string | null;
  avg_daily_sales: number | null;
};
export type Assembly = {
  id: number;
  assembly_date: string;
  employee_name: string;
  article_name: string;
  qty: number;
  confirmed: number;
  pay_per_unit: number;
  amount: number;
  created_at: string;
};
export type Shipment = {
  id: number;
  shipment_type: string;
  shipment_date: string;
  article_name: string;
  qty: number;
  collected: number;
  status: string;
  created_at: string;
};
export type SalaryRow = {
  employee_name: string;
  total_qty: number;
  confirmed_qty: number;
  confirmed_amount: number;
  pending_amount: number;
};
export type ForecastDay = {
  date: string;
  canProduce: number;
  needed: number;
};
export type ArticleSummary = {
  id: number;
  name: string;
  pay_per_unit: number;
  plan_fbs_per_day: number;
  avg_daily_sales: number | null;
  wb_synced_at: string | null;
  total_stock: number;
};
export type Stock = {
  article_name: string;
  warehouse_name: string;
  quantity: number;
  updated_at: string;
};
