import { SlidersHorizontal, X } from 'lucide-react';
import type { Category } from '../../types';

export interface ProductFilterValues {
  categoryId: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  sort: string;
}

export function ProductFilters({ categories, values, collection, onChange, onClear, mobileOpen, onMobileOpenChange }: {
  categories: Category[];
  values: ProductFilterValues;
  collection?: string;
  onChange: (next: Partial<ProductFilterValues>) => void;
  onClear: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const filterBody = <>
    <div className="filter-panel-heading"><strong>Bộ lọc sản phẩm</strong><button className="filter-close" type="button" aria-label="Đóng bộ lọc" onClick={() => onMobileOpenChange(false)}><X size={19} /></button></div>
    <fieldset className="filter-group"><legend>Danh mục</legend>
      <label className="filter-option"><input type="radio" name="product-category" checked={!values.categoryId} onChange={() => onChange({ categoryId: '' })} />Tất cả danh mục</label>
      {categories.map((category) => <label className="filter-option" key={category._id}><input type="radio" name="product-category" checked={values.categoryId === category._id} onChange={() => onChange({ categoryId: category._id })} />{category.categoryName}</label>)}
    </fieldset>
    <fieldset className="filter-group"><legend>Khoảng giá</legend>
      <div className="price-inputs"><label><span>Từ</span><input aria-label="Giá thấp nhất" inputMode="numeric" type="number" min="0" value={values.minPrice} onChange={(event) => onChange({ minPrice: event.target.value })} /></label><span aria-hidden="true">–</span><label><span>Đến</span><input aria-label="Giá cao nhất" inputMode="numeric" type="number" min="0" value={values.maxPrice} onChange={(event) => onChange({ maxPrice: event.target.value })} /></label></div>
      <div className="quick-prices"><button type="button" className={values.maxPrice === '50000' && !values.minPrice ? 'selected' : ''} onClick={() => onChange({ minPrice: '', maxPrice: '50000' })}>Dưới 50.000đ</button><button type="button" className={values.minPrice === '50000' && values.maxPrice === '100000' ? 'selected' : ''} onClick={() => onChange({ minPrice: '50000', maxPrice: '100000' })}>50.000–100.000đ</button><button type="button" className={values.minPrice === '100000' && !values.maxPrice ? 'selected' : ''} onClick={() => onChange({ minPrice: '100000', maxPrice: '' })}>Trên 100.000đ</button></div>
    </fieldset>
    <label className="filter-stock"><input type="checkbox" checked={values.inStock} onChange={(event) => onChange({ inStock: event.target.checked })} />Chỉ hiện sản phẩm còn hàng</label>
    <button className="filter-clear" type="button" onClick={onClear}>Xóa bộ lọc</button>
  </>;

  return <>
    <button className="mobile-filter-trigger" type="button" aria-expanded={mobileOpen} onClick={() => onMobileOpenChange(true)}><SlidersHorizontal size={17} />Bộ lọc</button>
    <aside className="product-filter-sidebar" aria-label="Bộ lọc sản phẩm">{filterBody}</aside>
    {mobileOpen && <div className="filter-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onMobileOpenChange(false); }}>
      <section className="filter-drawer" role="dialog" aria-modal="true" aria-label="Bộ lọc sản phẩm" data-collection={collection}>{filterBody}<button className="filter-apply" type="button" onClick={() => onMobileOpenChange(false)}>Xem kết quả</button></section>
    </div>}
  </>;
}