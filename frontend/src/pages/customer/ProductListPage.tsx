import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, ChevronDown, X } from 'lucide-react';
import { activitiesApi } from '../../api/activities';
import { categoriesApi } from '../../api/categories';
import { productsApi } from '../../api/products';
import { recommendationsApi } from '../../api/recommendations';
import { storesApi } from '../../api/stores';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { Pagination } from '../../components/common/Pagination';
import { ProductFilters, type ProductFilterValues } from '../../components/product/ProductFilters';
import { ProductGrid } from '../../components/product/ProductGrid';
import { RecommendationSection } from '../../components/recommendation/RecommendationSection';
import type { Category } from '../../types';
import type { Product } from '../../types/product';
import type { StoreLocation } from '../../types/store';
import { useStoreSelection } from '../../store/storeSelectionStore';

const PAGE_SIZE = 20;

function parsePrice(value: string | null) {
  if (!value) return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : '';
}

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { storeId } = useStoreSelection();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [retryKey, setRetryKey] = useState(0);
  const [priceDraft, setPriceDraft] = useState({ minPrice: parsePrice(searchParams.get('minPrice')), maxPrice: parsePrice(searchParams.get('maxPrice')) });

  const query = searchParams.get('q')?.trim() ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const collectionValue = searchParams.get('collection');
  const collection = collectionValue === 'bestseller' || collectionValue === 'deals' ? collectionValue : undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const values: ProductFilterValues = {
    categoryId,
    minPrice: parsePrice(searchParams.get('minPrice')),
    maxPrice: parsePrice(searchParams.get('maxPrice')),
    inStock: searchParams.get('inStock') !== 'false',
    sort: searchParams.get('sort') ?? '',
  };

  useEffect(() => {
    setPriceDraft({ minPrice: values.minPrice, maxPrice: values.maxPrice });
  }, [values.minPrice, values.maxPrice]);

  useEffect(() => {
    if (priceDraft.minPrice === values.minPrice && priceDraft.maxPrice === values.maxPrice) return;
    const timer = window.setTimeout(() => updateParams({
      minPrice: priceDraft.minPrice || undefined,
      maxPrice: priceDraft.maxPrice || undefined,
    }), 400);
    return () => window.clearTimeout(timer);
  }, [priceDraft.minPrice, priceDraft.maxPrice]);

  useEffect(() => {
    let active = true;
    categoriesApi.list().then((items) => { if (active) setCategories(items); }).catch(() => { if (active) setCategories([]); });
    storesApi.list().then((items) => { if (active) setStores(items); }).catch(() => { if (active) setStores([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    productsApi.listPage({
      storeId, q: query || undefined, categoryId: categoryId || undefined, collection,
      minPrice: values.minPrice ? Number(values.minPrice) : undefined,
      maxPrice: values.maxPrice ? Number(values.maxPrice) : undefined,
      inStock: values.inStock, sort: values.sort || undefined, page, limit: PAGE_SIZE,
    }).then((result) => {
      if (active) { setProducts(result.items); setTotal(result.total); }
    }).catch(() => {
      if (active) { setProducts([]); setTotal(0); setError(true); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [storeId, query, categoryId, collection, values.minPrice, values.maxPrice, values.inStock, values.sort, page, retryKey]);

  useEffect(() => {
    if (!query) return;
    activitiesApi.recordSearch(query).catch(() => undefined);
  }, [query]);

  useEffect(() => {
    if (!collection || collection === 'deals') return;
    let active = true;
    recommendationsApi.product(storeId).then((result) => { if (active) setRecommendations(result); });
    return () => { active = false; };
  }, [collection, storeId]);

  const selectedCategory = categories.find((category) => category._id === categoryId);
  const selectedStoreName = stores.find((store) => store._id === storeId)?.name ?? 'cửa hàng bạn chọn';
  const title = query ? `Kết quả cho "${query}"` : collection === 'bestseller' ? 'Hàng bán chạy' : collection === 'deals' ? 'Ưu đãi hôm nay' : selectedCategory?.categoryName ?? 'Tất cả sản phẩm';
  const description = query ? 'Tìm thấy những sản phẩm phù hợp tại cửa hàng bạn chọn.' : collection === 'deals' ? 'Ưu đãi tươi ngon đang áp dụng tại cửa hàng của bạn.' : collection === 'bestseller' ? 'Những sản phẩm được khách hàng yêu thích và lựa chọn nhiều nhất.' : 'Khám phá thực phẩm tươi ngon được chọn lọc mỗi ngày.';
  const sortOptions = useMemo(() => [
    { value: '', label: 'Phù hợp nhất' },
    { value: 'price', label: 'Giá thấp đến cao' },
    { value: '-price', label: 'Giá cao đến thấp' },
    { value: '-createdAt', label: 'Mới nhất' },
    { value: '-sold', label: 'Bán chạy' },
    ...(collection === 'deals' ? [{ value: '-discount', label: 'Giảm nhiều nhất' }] : []),
  ], [collection]);

  function updateParams(patch: Partial<Record<string, string | undefined>>, replace = false) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (patch.page === undefined && Object.keys(patch).some((key) => key !== 'page')) next.delete('page');
    setSearchParams(next, { replace });
  }

  function updateFilters(next: Partial<ProductFilterValues>) {
    const patch: Record<string, string | undefined> = {};
    if ('categoryId' in next) patch.categoryId = next.categoryId || undefined;
    if ('minPrice' in next) patch.minPrice = next.minPrice || undefined;
    if ('maxPrice' in next) patch.maxPrice = next.maxPrice || undefined;
    if ('inStock' in next) patch.inStock = next.inStock ? undefined : 'false';
    if ('sort' in next) patch.sort = next.sort || undefined;
    updateParams(patch);
  }

  function handleFilterChange(next: Partial<ProductFilterValues>) {
    if ('minPrice' in next || 'maxPrice' in next) {
      setPriceDraft((current) => ({ ...current, ...next }));
      return;
    }
    updateFilters(next);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    ['categoryId', 'minPrice', 'maxPrice', 'inStock', 'sort', 'page'].forEach((key) => next.delete(key));
    setSearchParams(next);
  }

  function changePage(nextPage: number) {
    updateParams({ page: nextPage === 1 ? undefined : String(nextPage) });
    document.getElementById('product-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function removeChip(key: string) {
    if (key === 'price') updateParams({ minPrice: undefined, maxPrice: undefined });
    else if (key === 'inStock') updateParams({ inStock: undefined });
    else updateParams({ [key]: undefined });
  }

  const chips = [
    ...(selectedCategory ? [{ key: 'categoryId', label: selectedCategory.categoryName }] : []),
    ...(values.minPrice || values.maxPrice ? [{ key: 'price', label: `${values.minPrice ? Number(values.minPrice).toLocaleString('vi-VN') : '0'}đ – ${values.maxPrice ? Number(values.maxPrice).toLocaleString('vi-VN') : 'không giới hạn'}` }] : []),
    ...(!values.inStock ? [{ key: 'inStock', label: 'Có cả sản phẩm hết hàng' }] : []),
    ...(values.sort ? [{ key: 'sort', label: sortOptions.find((option) => option.value === values.sort)?.label ?? 'Sắp xếp' }] : []),
  ];

  return <div className="customer-shell listing-page">
    <Breadcrumb items={[{ label: title }]} />
    <header className="listing-heading"><span className="section-eyebrow">GIAN HÀNG MUADEE</span><h1>{title}</h1><p>{description}</p></header>
    <div className="listing-count" aria-live="polite">{loading ? 'Đang cập nhật kết quả...' : `${total.toLocaleString('vi-VN')} sản phẩm tại ${selectedStoreName}`}</div>
    <div className="listing-layout">
      <ProductFilters categories={categories} values={{ ...values, ...priceDraft }} collection={collection} onChange={handleFilterChange} onClear={() => { setPriceDraft({ minPrice: '', maxPrice: '' }); clearFilters(); }} mobileOpen={mobileFilterOpen} onMobileOpenChange={setMobileFilterOpen} />
      <section className="listing-results" id="product-results" aria-label="Kết quả sản phẩm">
        <div className="listing-toolbar"><div className="listing-chips">{chips.map((chip) => <span className="filter-chip" key={chip.key}>{chip.label}<button type="button" aria-label={`Bỏ lọc ${chip.label}`} onClick={() => removeChip(chip.key)}><X size={14} /></button></span>)}</div><label className="sort-control"><span>Sắp xếp</span><select aria-label="Sắp xếp sản phẩm" value={values.sort} onChange={(event) => updateFilters({ sort: event.target.value })}>{sortOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></label></div>
        <ProductGrid products={products} loading={loading} error={error} collection={collection} rankOffset={(page - 1) * PAGE_SIZE} onLoginRequired={() => window.dispatchEvent(new Event('muadee:login-required'))} onRetry={() => setRetryKey((value) => value + 1)} onClear={clearFilters} onChangeStore={() => window.dispatchEvent(new Event('muadee:open-store-selector'))} />
        {!loading && !error && <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} onChange={changePage} />}
      </section>
    </div>
    {(collection === 'bestseller' || Boolean(categoryId)) && <RecommendationSection title="Có thể bạn quan tâm" eyebrow="GỢI Ý DÀNH CHO BẠN" products={recommendations} loading={false} onLoginRequired={() => window.dispatchEvent(new Event('muadee:login-required'))} inStockOnly />}
    <button className="back-to-top" type="button" aria-label="Cuộn lên đầu trang" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={18} /></button>
  </div>;
}