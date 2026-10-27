import { ChevronRight, House } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return <nav className="page-breadcrumb" aria-label="Đường dẫn trang">
    <Link to="/" aria-label="Trang chủ"><House size={14} /></Link>
    {items.map((item, index) => <span className="breadcrumb-item" key={`${item.label}-${index}`}>
      <ChevronRight size={13} aria-hidden="true" />
      {item.to && index < items.length - 1 ? <Link to={item.to}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
    </span>)}
  </nav>;
}