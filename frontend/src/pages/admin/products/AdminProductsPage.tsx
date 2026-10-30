import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, PackageSearch, Pencil, Plus, Search, X } from 'lucide-react';
import { categoriesApi } from '../../../api/categories';
import { errorMessage } from '../../../api/client';
import { productsApi, type AdminProductInput, type AdminProductRecord, type AdminProductPage } from '../../../api/products';
import type { Category } from '../../../types';
import './AdminProductsPage.css';

const PAGE_LIMIT = 20;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const allowedImageTypes = new Map<string, string[]>([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/webp', ['.webp']],
]);
const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

interface ProductForm {
  productName: string;
  description: string;
  categoryId: string;
  price: string;
  unit: string;
  status: 'ACTIVE' | 'INACTIVE';
  imageFile: File | null;
  existingImage: string;
}

const emptyForm: ProductForm = {
  productName: '', description: '', categoryId: '', price: '', unit: 'kg', status: 'ACTIVE', imageFile: null, existingImage: '',
};

function imageUrl(image: string): string {
  if (!image || /^(https?:|data:|blob:)/i.test(image)) return image;
  const apiUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
  const backendOrigin = apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${backendOrigin}${image.startsWith('/') ? image : `/${image}`}`;
}

function acceptedImage(file: File): boolean {
  const extensions = allowedImageTypes.get(file.type);
  const extension = file.name.toLocaleLowerCase('vi').match(/\.[^.]+$/)?.[0];
  return Boolean(extensions && extension && extensions.includes(extension));
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pageData, setPageData] = useState<AdminProductPage>({ items: [], total: 0, page: 1, limit: PAGE_LIMIT });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductRecord | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadProducts() {
    setLoading(true);
    setLoadError('');
    try {
      const result = await productsApi.adminListPage({ q: query || undefined, categoryId: categoryId || undefined, page, limit: PAGE_LIMIT });
      setProducts(result.items);
      setPageData(result);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    categoriesApi.list().then((items) => { if (active) setCategories(items); }).catch((error: unknown) => { if (active) setCategoryError(errorMessage(error)); });
    return () => { active = false; };
  }, []);

  useEffect(() => { void loadProducts(); }, [query, categoryId, page]);

  useEffect(() => {
    if (form.imageFile) {
      const localUrl = URL.createObjectURL(form.imageFile);
      setPreviewUrl(localUrl);
      return () => URL.revokeObjectURL(localUrl);
    }
    setPreviewUrl(imageUrl(form.existingImage));
    return undefined;
  }, [form.imageFile, form.existingImage]);

  function searchProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(searchDraft.trim());
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, categoryId: categories[0]?._id ?? '' });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(product: AdminProductRecord) {
    setEditing(product);
    setForm({
      productName: product.productName,
      description: product.description,
      categoryId: product.categoryId,
      price: String(product.price),
      unit: product.unit || 'kg',
      status: product.status,
      imageFile: null,
      existingImage: product.image,
    });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError('');
    setForm(emptyForm);
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!acceptedImage(file)) {
      setForm((current) => ({ ...current, imageFile: null }));
      setFormError('Ảnh phải là JPG, PNG hoặc WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setForm((current) => ({ ...current, imageFile: null }));
      setFormError('Dung lượng ảnh không được vượt quá 2 MB.');
      event.target.value = '';
      return;
    }
    setFormError('');
    setForm((current) => ({ ...current, imageFile: file }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.productName.trim() || !form.description.trim() || !form.categoryId || !Number.isFinite(price) || price < 0) {
      setFormError('Vui lòng nhập đầy đủ thông tin và giá bán hợp lệ.');
      return;
    }
    const input: AdminProductInput = {
      productName: form.productName.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      price,
      unit: form.unit,
      status: form.status,
      ...(form.imageFile ? { image: form.imageFile } : {}),
    };
    setSaving(true);
    setFormError('');
    try {
      if (editing) await productsApi.adminUpdate(editing.productId, input);
      else await productsApi.adminCreate(input);
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadProducts();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(pageData.total / PAGE_LIMIT));

  return (
    <section className="admin-products">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">QUẢN LÝ DANH MỤC HÀNG HÓA</span><h1>Sản phẩm</h1></div>
        <button className="admin-primary-button" type="button" onClick={openCreate} disabled={categories.length === 0}><Plus size={16} /> Thêm sản phẩm</button>
      </div>

      <form className="products-toolbar" onSubmit={searchProducts}>
        <div className="products-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm sản phẩm" placeholder="Tìm tên sản phẩm" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /><button type="submit" aria-label="Tìm kiếm"><Search size={15} /></button></div>
        <label className="products-category-filter"><span>Danh mục</span><select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}><option value="">Tất cả danh mục</option>{categories.map((category) => <option value={category._id} key={category._id}>{category.categoryName}</option>)}</select></label>
        <span className="products-count">{pageData.total} sản phẩm</span>
      </form>

      {categoryError && <div className="admin-inline-error" role="alert">Không tải được danh mục: {categoryError}</div>}

      <div className="products-table-wrap">
        <table className="products-table">
          <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Đơn vị</th><th>Trạng thái</th><th className="products-actions-heading">Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td className="products-state" colSpan={6}><span className="admin-loading-mark" />Đang tải sản phẩm...</td></tr>}
            {!loading && loadError && <tr><td className="products-state products-state-error" colSpan={6}><strong>Không tải được sản phẩm</strong><span>{loadError}</span><button type="button" onClick={() => void loadProducts()}>Thử lại</button></td></tr>}
            {!loading && !loadError && products.length === 0 && <tr><td className="products-state" colSpan={6}><span className="products-empty-icon"><PackageSearch size={21} /></span><strong>{query || categoryId ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có sản phẩm nào'}</strong><span>{query || categoryId ? 'Thử từ khóa hoặc danh mục khác.' : 'Thêm sản phẩm đầu tiên vào danh mục hàng hóa.'}</span></td></tr>}
            {!loading && !loadError && products.map((product) => (
              <tr key={product.productId}>
                <td><div className="products-name-cell">{product.image ? <img src={imageUrl(product.image)} alt="" /> : <span className="products-image-placeholder"><PackageSearch size={17} /></span>}<strong>{product.productName}</strong></div></td>
                <td className="products-category-name">{product.categoryName || categories.find((category) => category._id === product.categoryId)?.categoryName || '—'}</td>
                <td className="products-price">{currency.format(product.price)}</td>
                <td>{product.unit}</td>
                <td><span className={`products-status ${product.status === 'ACTIVE' ? 'active' : 'inactive'}`}><i />{product.status === 'ACTIVE' ? 'Đang bán' : 'Ngừng bán'}</span></td>
                <td><div className="products-row-actions"><button type="button" aria-label={`Sửa ${product.productName}`} title="Chỉnh sửa" onClick={() => openEdit(product)}><Pencil size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !loadError && pageData.total > PAGE_LIMIT && <nav className="products-pagination" aria-label="Phân trang sản phẩm"><span>Trang {page} / {totalPages}</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Trước</button><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Tiếp</button></div></nav>}

      {formOpen && (
        <div className="products-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="products-modal" role="dialog" aria-modal="true" aria-labelledby="products-modal-title">
            <header><div><span className="admin-eyebrow">SẢN PHẨM</span><h2 id="products-modal-title">{editing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</h2></div><button type="button" className="products-modal-close" aria-label="Đóng" onClick={closeForm}><X size={19} /></button></header>
            <form onSubmit={(event) => void submitForm(event)}>
              <div className="products-form-grid">
                <label className="products-form-wide">Tên sản phẩm <span>*</span><input autoFocus maxLength={150} value={form.productName} onChange={(event) => setForm((current) => ({ ...current, productName: event.target.value }))} placeholder="Ví dụ: Cà chua bi Đà Lạt" required /></label>
                <label className="products-form-wide">Mô tả <span>*</span><textarea rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Thông tin mô tả sản phẩm" required /></label>
                <label>Giá bán (VND) <span>*</span><input type="number" min="0" step="100" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="0" required /></label>
                <label>Đơn vị <span>*</span><select value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))}>{['kg', 'g', 'gói', 'túi', 'chai', 'hộp', 'lốc', 'cái', 'bó'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                <label className="products-form-wide">Danh mục <span>*</span><select value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))} required><option value="" disabled>Chọn danh mục</option>{categories.map((category) => <option value={category._id} key={category._id}>{category.categoryName}</option>)}</select></label>
                <label className="products-form-wide">Trạng thái<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AdminProductInput['status'] }))}><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Ngừng bán</option></select></label>
                <div className="products-form-wide products-image-field"><span className="products-field-label">Ảnh sản phẩm <small>JPG, PNG hoặc WebP · tối đa 2 MB</small></span><label className="products-image-drop"><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={chooseImage} /><span className="products-image-preview">{previewUrl ? <img src={previewUrl} alt="Xem trước ảnh sản phẩm" /> : <ImagePlus size={23} />}</span><span><strong>{form.imageFile?.name ?? (form.existingImage ? 'Đổi ảnh sản phẩm' : 'Chọn ảnh')}</strong><small>{form.imageFile ? `${(form.imageFile.size / 1024).toFixed(0)} KB` : 'Ảnh tải lên là tùy chọn'}</small></span></label></div>
              </div>
              {formError && <p className="admin-inline-error" role="alert">{formError}</p>}
              <footer><button className="products-secondary-button" type="button" onClick={closeForm} disabled={saving}>Hủy</button><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo sản phẩm'}</button></footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
