import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FlaskConical, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productsApi } from '../../api/products';
import { recommendationsApi } from '../../api/recommendations';
import { RecommendationSection } from '../../components/recommendation/RecommendationSection';
import { storesApi } from '../../api/stores';
import { useStoreSelection, storeSelectionStore } from '../../store/storeSelectionStore';
import type { Product } from '../../types/product';
import { recommenderBenchmark } from '../../data/recommenderBenchmark';

const scenarios = [
  { id: 'all_test', label: 'Tổng thể test' },
  { id: 'warm_item', label: 'Sản phẩm đã thấy' },
  { id: 'cold_user', label: 'Khách mới' },
  { id: 'cold_item_unseen_catalog', label: 'Sản phẩm mới' },
] as const;

type Scenario = (typeof scenarios)[number]['id'];

export default function RecommenderLabPage() {
  const { storeId } = useStoreSelection();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [demoProducts, setDemoProducts] = useState<Product[]>([]);
  const [demoStrategy, setDemoStrategy] = useState('');
  const [demoMode, setDemoMode] = useState<'similar' | 'cold-user'>('similar');
  const [loading, setLoading] = useState(false);
  const [scenario, setScenario] = useState<Scenario>('all_test');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    storesApi.list().then((stores) => {
      if (!active || !stores.length) return;
      const validStore = stores.find((store) => store._id === storeId) ?? stores[0];
      if (validStore._id !== storeId) storeSelectionStore.setStore(validStore._id);
      return productsApi.list({ storeId: validStore._id }).then((items) => {
        if (!active) return;
        const available = items.filter((product) => product.status === 'ACTIVE' && product.stock > 0);
        setProducts(available);
        setSelectedProductId((current) => current || available[0]?.productId || '');
      });
    }).catch(() => { if (active) setError('Không tải được cửa hàng hoặc sản phẩm. Hãy kiểm tra backend và database.'); });
    return () => { active = false; };
  }, [storeId]);

  const results = useMemo(() => recommenderBenchmark.rows.filter((row) => row.scenario === scenario), [scenario]);

  async function runDemo() {
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      const result = await recommendationsApi.productResult(storeId, products, demoMode === 'similar' ? selectedProductId : undefined);
      setDemoProducts(result.products);
      setDemoStrategy(result.strategy);
    } catch {
      setDemoProducts([]);
      setDemoStrategy('unavailable');
      setError('Chưa kết nối được dịch vụ gợi ý.');
    } finally { setLoading(false); }
  }

  return <main className="customer-shell recommender-lab">
    <div className="lab-breadcrumb"><Link to="/">Trang chủ</Link><ArrowRight size={14} /><span>Nghiên cứu recommender</span></div>
    <header className="lab-hero"><span className="section-eyebrow"><FlaskConical size={15} /> THỬ NGHIỆM RECOMMENDER</span><h1>Đánh giá thuật toán gợi ý</h1><p>Benchmark trên Online Retail II với chia dữ liệu theo thời gian, so sánh bốn thuật toán và kiểm tra các trường hợp cold-start.</p></header>

    <section className="lab-dataset-grid" aria-label="Tóm tắt dữ liệu và chia thời gian">
      <article><span>Dataset</span><strong>UCI Online Retail II</strong><small>{recommenderBenchmark.dataset.period}</small></article>
      <article><span>Tương tác</span><strong>{recommenderBenchmark.split.interactions.toLocaleString('vi-VN')}</strong><small>{recommenderBenchmark.split.users.toLocaleString('vi-VN')} khách · {recommenderBenchmark.split.items.toLocaleString('vi-VN')} sản phẩm</small></article>
      <article><span>Chia theo thời gian</span><strong>70% · 10% · 20%</strong><small>Train · Validation · Test</small></article>
      <article><span>Cold-start trong test</span><strong>{recommenderBenchmark.split.cold_users} khách · {recommenderBenchmark.split.cold_items} SKU</strong><small>Top-{recommenderBenchmark.split.k} recommendation</small></article>
    </section>

    <section className="lab-benchmark" aria-labelledby="lab-benchmark-title">
      <div className="lab-section-heading"><div><span className="section-eyebrow">KẾT QUẢ THỰC NGHIỆM</span><h2 id="lab-benchmark-title">So sánh trên tập test</h2></div><div className="lab-scenario-tabs" role="tablist" aria-label="Kịch bản đánh giá">{scenarios.map((item) => <button key={item.id} type="button" role="tab" aria-selected={scenario === item.id} className={scenario === item.id ? 'selected' : ''} onClick={() => setScenario(item.id)}>{item.label}</button>)}</div></div>
      <div className="lab-table-wrap"><table><thead><tr><th>Thuật toán</th><th>Recall@10</th><th>NDCG@10</th><th>HitRate@10</th><th>Catalog coverage</th><th>Khách được đánh giá</th></tr></thead><tbody>{results.map((row) => <tr key={`${row.model}-${row.scenario}`}><th scope="row">{row.model}</th><td>{(row.recall * 100).toFixed(2)}%</td><td>{(row.ndcg * 100).toFixed(2)}%</td><td>{(row.hitRate * 100).toFixed(2)}%</td><td>{(row.coverage * 100).toFixed(2)}%</td><td>{row.users.toLocaleString('vi-VN')}</td></tr>)}</tbody></table></div>
      <p className="lab-note">Recall, NDCG và HitRate càng cao càng tốt. Coverage đo tỷ lệ catalog được gợi ý. Collaborative filtering không thể đưa SKU chưa xuất hiện trong train vào danh sách, nên kịch bản “Sản phẩm mới” thể hiện giới hạn cold-item.</p>
      <p className="lab-note">Kết quả ngoại tuyến dùng UCI để so sánh thuật toán; danh sách sản phẩm phía dưới chạy trực tiếp trên catalog và tồn kho của project.</p>
    </section>

    <section className="lab-live" aria-labelledby="lab-live-title">
      <div className="lab-section-heading"><div><span className="section-eyebrow">KIỂM TRA TRÊN PROJECT</span><h2 id="lab-live-title">Chạy gợi ý trực tiếp</h2><p>Chọn một sản phẩm để xem gợi ý theo nội dung, hoặc chọn khách mới để kiểm tra fallback bán chạy.</p></div></div>
      <div className="lab-controls"><label>Trường hợp<select value={demoMode} onChange={(event) => setDemoMode(event.target.value as 'similar' | 'cold-user')}><option value="similar">Đang xem một sản phẩm</option><option value="cold-user">Khách mới (cold-start)</option></select></label>{demoMode === 'similar' && <label>Sản phẩm<select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>{products.map((product) => <option key={product.productId} value={product.productId}>{product.productName}</option>)}</select></label>}<button type="button" className="primary-button" onClick={() => void runDemo()} disabled={loading || !products.length}><RefreshCw size={16} className={loading ? 'lab-spinning' : ''} />{loading ? 'Đang gợi ý…' : 'Chạy thử'}</button></div>
      {error && <p className="lab-error" role="alert">{error}</p>}
      {demoStrategy && <p className="lab-result-status" role="status">Chiến lược đang chạy: <strong>{demoStrategy}</strong></p>}
      <RecommendationSection title={demoMode === 'cold-user' ? 'Bán chạy cho khách mới' : 'Sản phẩm tương tự'} eyebrow={demoMode === 'cold-user' ? 'COLD-START FALLBACK' : 'CONTENT-BASED RECOMMENDATION'} products={demoProducts} loading={loading} inStockOnly emptyMessage="Chưa có gợi ý. Chọn cửa hàng khác hoặc thử lại." onLoginRequired={() => window.dispatchEvent(new Event('muadee:login-required'))} />
    </section>
  </main>;
}
