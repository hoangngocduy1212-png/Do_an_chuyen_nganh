import { useEffect, useState, type FormEvent } from 'react';
import { FolderTree, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { categoriesApi } from '../../../api/categories';
import { errorMessage } from '../../../api/client';
import type { Category } from '../../../types';
import './AdminCategoriesPage.css';

interface CategoryForm {
  categoryName: string;
  description: string;
}

const emptyForm: CategoryForm = { categoryName: '', description: '' };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  async function loadCategories() {
    setLoading(true);
    setLoadError('');
    try {
      setCategories(await categoriesApi.list());
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCategories(); }, []);

  const filteredCategories = categories.filter((category) =>
    `${category.categoryName} ${category.description ?? ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setActionError('');
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({ categoryName: category.categoryName, description: category.description ?? '' });
    setFormError('');
    setActionError('');
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError('');
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const categoryName = form.categoryName.trim();
    if (!categoryName) {
      setFormError('Vui lòng nhập tên danh mục.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing) await categoriesApi.update(editing._id, { categoryName, description: form.description.trim() || undefined });
      else await categoriesApi.create({ categoryName, description: form.description.trim() || undefined });
      setFormOpen(false);
      setEditing(null);
      await loadCategories();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function removeCategory(category: Category) {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa danh mục “${category.categoryName}” không?`);
    if (!confirmed) return;
    setActionError('');
    try {
      await categoriesApi.remove(category._id);
      await loadCategories();
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  return (
    <section className="admin-categories">
      <div className="admin-page-heading">
        <div><span className="admin-eyebrow">QUẢN LÝ DANH MỤC</span><h1>Danh mục</h1></div>
        <button className="admin-primary-button" type="button" onClick={openCreate}><Plus size={16} /> Thêm danh mục</button>
      </div>

      <div className="category-toolbar">
        <div className="category-search"><Search size={16} aria-hidden="true" /><input aria-label="Tìm danh mục" placeholder="Tìm theo tên hoặc mô tả" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <span className="category-count">{categories.length} danh mục</span>
      </div>

      {actionError && <div className="admin-inline-error" role="alert">{actionError}</div>}

      <div className="category-table-wrap">
        <table className="category-table">
          <thead><tr><th>Tên danh mục</th><th>Mô tả</th><th className="category-action-heading">Thao tác</th></tr></thead>
          <tbody>
            {loading && <tr><td className="category-state" colSpan={3}><span className="admin-loading-mark" />Đang tải danh mục...</td></tr>}
            {!loading && loadError && <tr><td className="category-state category-state-error" colSpan={3}><strong>Không tải được danh mục</strong><span>{loadError}</span><button type="button" onClick={() => void loadCategories()}>Thử lại</button></td></tr>}
            {!loading && !loadError && filteredCategories.length === 0 && <tr><td className="category-state" colSpan={3}><span className="category-empty-icon"><FolderTree size={21} /></span><strong>{search ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục nào'}</strong><span>{search ? 'Thử từ khóa khác.' : 'Thêm danh mục đầu tiên để phân loại sản phẩm.'}</span></td></tr>}
            {!loading && !loadError && filteredCategories.map((category, index) => (
              <tr key={category._id}>
                <td><div className="category-name-cell"><span className="category-index">{String(index + 1).padStart(2, '0')}</span><strong>{category.categoryName}</strong></div></td>
                <td className="category-description">{category.description?.trim() || 'Chưa có mô tả'}</td>
                <td><div className="category-row-actions"><button type="button" aria-label={`Sửa ${category.categoryName}`} title="Chỉnh sửa" onClick={() => openEdit(category)}><Pencil size={16} /></button><button className="category-delete" type="button" aria-label={`Xóa ${category.categoryName}`} title="Xóa" onClick={() => void removeCategory(category)}><Trash2 size={16} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="category-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
            <header><div><span className="admin-eyebrow">DANH MỤC</span><h2 id="category-modal-title">{editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục'}</h2></div><button type="button" className="category-modal-close" aria-label="Đóng" onClick={closeForm}><X size={19} /></button></header>
            <form onSubmit={(event) => void submitForm(event)}>
              <label>Tên danh mục <span>*</span><input autoFocus maxLength={100} value={form.categoryName} onChange={(event) => setForm((current) => ({ ...current, categoryName: event.target.value }))} placeholder="Ví dụ: Rau củ" required /></label>
              <label>Mô tả <small>Không bắt buộc</small><textarea maxLength={500} rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả ngắn về nhóm sản phẩm" /></label>
              {formError && <p className="admin-inline-error" role="alert">{formError}</p>}
              <footer><button className="category-secondary-button" type="button" onClick={closeForm} disabled={saving}>Hủy</button><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo danh mục'}</button></footer>
            </form>
          </section>
        </div>
      )}

    </section>
  );
}