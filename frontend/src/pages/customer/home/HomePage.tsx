import { useEffect, useState } from 'react';
import { categoriesApi } from '../../../api/categories.api';
import { errorMessage } from '../../../api/client';
import type { Category } from '../../../types';

// Trang mau: goi GET /categories va hien thi. Cac trang khac lam theo cach nay.
export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <section>
      <h2>Danh mục sản phẩm</h2>
      {error && <p className="error">Không tải được dữ liệu: {error}</p>}
      <div className="grid">
        {categories.map((c) => (
          <div className="card" key={c._id}><strong>{c.categoryName}</strong><p>{c.description}</p></div>
        ))}
      </div>
      {!error && categories.length === 0 && <p>Chưa có danh mục nào.</p>}
    </section>
  );
}
