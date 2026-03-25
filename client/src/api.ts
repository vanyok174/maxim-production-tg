const initHeader = (): HeadersInit => {
  const raw = window.Telegram?.WebApp?.initData || '';
  return { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': raw };
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    headers: initHeader(),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}

export async function apiPost<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}api/${path}`, {
    method: 'POST',
    headers: initHeader(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}
