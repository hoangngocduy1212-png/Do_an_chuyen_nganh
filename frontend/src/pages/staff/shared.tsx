import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Tra tên hiển thị cho danh sách ID, mỗi ID chỉ gọi API một lần; lỗi thì giữ nguyên ID. */
export function useLabels(ids: string[], fetcher: (id: string) => Promise<string>): (id: string) => string {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const key = ids.join('|');
  useEffect(() => {
    const missing = [...new Set(ids)].filter((id) => id && !requested.current.has(id));
    missing.forEach((id) => requested.current.add(id));
    void Promise.all(missing.map((id) => fetcher(id).then((label) => [id, label] as const).catch(() => null))).then((pairs) => {
      const found = pairs.filter((pair): pair is readonly [string, string] => pair !== null);
      if (found.length) setLabels((current) => ({ ...current, ...Object.fromEntries(found) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (id) => labels[id] ?? id;
}

export const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function Heading({ eyebrow, title, extra }: { eyebrow: string; title: string; extra?: ReactNode }) {
  return <div className="admin-page-heading"><div><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1></div>{extra}</div>;
}

export function Pager({ page, limit, total, onChange }: { page: number; limit: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="staff-pager">
      <span>{total.toLocaleString('vi-VN')} mục</span>
      <button className="staff-btn secondary" type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button>
      <span>{page}/{pages}</span>
      <button className="staff-btn secondary" type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}>Sau</button>
    </div>
  );
}
