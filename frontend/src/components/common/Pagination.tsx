import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return <nav className="product-pagination" aria-label="Phân trang sản phẩm">
    <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={17} /></button>
    {pages.map((item) => <button key={item} type="button" aria-label={`Trang ${item}`} aria-current={page === item ? 'page' : undefined} className={page === item ? 'selected' : ''} onClick={() => onChange(item)}>{item}</button>)}
    <button type="button" aria-label="Trang sau" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight size={17} /></button>
  </nav>;
}