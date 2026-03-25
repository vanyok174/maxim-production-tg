/**
 * Средние продажи по артикулу WB: statistics-api supplier/sales.
 * @see https://dev.wildberries.ru — категория Statistics, метод sales (v1).
 */

export type WbArticleAvg = {
  key: string;
  totalQty: number;
  avgPerDay: number;
  daysInWindow: number;
};

function dateFromDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days));
  return d.toISOString().slice(0, 10);
}

type WbSaleRow = {
  supplierArticle?: string;
  quantity?: number;
  date?: string;
  lastChangeDate?: string;
  rrd_id?: number;
};

/**
 * Порционная выгрузка WB: повторяем запрос с rrd_id последней записи предыдущего ответа.
 */
export async function fetchWbSalesAggregated(params: {
  token: string;
  lookbackDays: number;
}): Promise<Map<string, { totalQty: number; days: Set<string> }>> {
  const map = new Map<string, { totalQty: number; days: Set<string> }>();
  const dateFrom = `${dateFromDaysAgo(params.lookbackDays)}T00:00:00`;
  const urlBase = 'https://statistics-api.wildberries.ru/api/v1/supplier/sales';

  let rrdid = 0;
  const maxRounds = 400;

  for (let round = 0; round < maxRounds; round++) {
    const q = new URLSearchParams({ dateFrom });
    if (rrdid > 0) q.set('rrdid', String(rrdid));
    const url = `${urlBase}?${q.toString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: params.token,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WB sales HTTP ${res.status}: ${text.slice(0, 500)}`);
    }

    const chunk = (await res.json()) as WbSaleRow[];
    if (!Array.isArray(chunk) || chunk.length === 0) break;

    for (const row of chunk) {
      const art = (row.supplierArticle ?? '').trim();
      if (!art) continue;
      const qty = Number(row.quantity) || 0;
      if (qty <= 0) continue;
      const dayRaw = row.date || row.lastChangeDate || '';
      const day = dayRaw ? String(dayRaw).slice(0, 10) : dateFrom.slice(0, 10);
      let rec = map.get(art);
      if (!rec) {
        rec = { totalQty: 0, days: new Set<string>() };
        map.set(art, rec);
      }
      rec.totalQty += qty;
      if (day) rec.days.add(day);
    }

    const last = chunk[chunk.length - 1];
    const nextRrd = typeof last?.rrd_id === 'number' ? last.rrd_id : 0;
    if (!nextRrd || nextRrd === rrdid) break;
    rrdid = nextRrd;
  }

  return map;
}

export function toAvgs(
  map: Map<string, { totalQty: number; days: Set<string> }>,
  calendarDays: number,
): WbArticleAvg[] {
  const out: WbArticleAvg[] = [];
  const windowDays = Math.max(1, calendarDays);
  for (const [key, v] of map) {
    const avgPerDay = v.totalQty / windowDays;
    out.push({
      key,
      totalQty: v.totalQty,
      avgPerDay,
      daysInWindow: v.days.size,
    });
  }
  return out;
}
