import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, MapPin, Store } from 'lucide-react';
import { productsApi } from '../../api/products';
import { storesApi } from '../../api/stores';
import type { StoreLocation } from '../../types/store';
import { useAuth } from '../../store/AuthContext';
import { useCart } from '../../store/cartStore';
import { storeSelectionStore, useStoreSelection } from '../../store/storeSelectionStore';

export function StoreReceiveSelector() {
  const selection = useStoreSelection();
  const cart = useCart();
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [pendingStoreId, setPendingStoreId] = useState(selection.storeId);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { storesApi.list().then(setStores).catch(() => setStores([])); }, []);
  useEffect(() => {
    const closeSelector = () => setOpen(false);
    const openSelector = () => setOpen(true);
    window.addEventListener('muadee:close-store-selector', closeSelector);
    window.addEventListener('muadee:open-store-selector', openSelector);
    function dismiss(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') setOpen(false);
      if (event instanceof MouseEvent && !rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('muadee:close-store-selector', closeSelector);
      window.removeEventListener('muadee:open-store-selector', openSelector);
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const selectedStore = stores.find((store) => store._id === selection.storeId);
  const summary = selectedStore?.name ?? 'Chọn cửa hàng';

  async function applyStore() {
    const nextStore = stores.find((store) => store._id === pendingStoreId);
    if (!nextStore) return;
    if (pendingStoreId !== selection.storeId && cart.length) {
      try {
        const available = await productsApi.list({ storeId: pendingStoreId });
        const unavailable = cart.filter((line) => !available.some((product) => product.productId === line.product.productId));
        if (unavailable.length && !window.confirm(`Có ${unavailable.length} sản phẩm trong giỏ không có tại ${nextStore.name}. Bạn vẫn muốn chuyển cửa hàng?`)) return;
      } catch { /* Continue if store stock cannot be checked. */ }
    }
    storeSelectionStore.setStore(pendingStoreId);
    setOpen(false);
    if (pendingStoreId !== selection.storeId) setToast(`Đã chuyển sang ${nextStore.name}`);
  }

  return (
    <div className="store-selector" ref={rootRef}>
      <button className="store-selector-trigger" type="button" aria-expanded={open} onClick={() => { if (!open) window.dispatchEvent(new Event('muadee:close-chat')); setPendingStoreId(selection.storeId); setOpen((value) => !value); }}>
        <span className="store-selector-icon"><MapPin size={19} /></span>
        <span><small>{selection.receiveMethod === 'DELIVERY' ? 'Giao từ' : 'Nhận tại'}</small><strong>{summary}</strong></span><ChevronDown size={16} />
      </button>
      {open && <div className="store-popover">
        <div className="popover-title"><strong>Chọn cách nhận hàng</strong><span>Đổi cửa hàng để xem giá và tồn kho phù hợp</span></div>
        <div className="receive-segment" role="group" aria-label="Hình thức nhận hàng">
          <button className={selection.receiveMethod === 'DELIVERY' ? 'selected' : ''} type="button" onClick={() => storeSelectionStore.setReceiveMethod('DELIVERY')}><MapPin size={16} />Giao tận nơi</button>
          <button className={selection.receiveMethod === 'PICKUP' ? 'selected' : ''} type="button" onClick={() => storeSelectionStore.setReceiveMethod('PICKUP')}><Store size={16} /><span>Nhận tại cửa hàng<small>Đặt trước, đến lấy</small></span></button>
        </div>
        {selection.receiveMethod === 'DELIVERY' && <label className="address-field">Địa chỉ nhận hàng<input value={selection.deliveryAddress || (user as (typeof user & { defaultAddress?: string }) | null)?.defaultAddress || ''} placeholder="Nhập địa chỉ giao hàng" onChange={(event) => storeSelectionStore.setDeliveryAddress(event.target.value)} /></label>}
        <div className="store-list-label">Cửa hàng đang hoạt động</div>
        <div className="store-options">{stores.map((store) => <button className={`store-option ${pendingStoreId === store._id ? 'selected' : ''}`} key={store._id} type="button" onClick={() => setPendingStoreId(store._id)}><span className="store-option-icon"><Store size={17} /></span><span><strong>{store.name}</strong><small>{store.address}</small></span>{pendingStoreId === store._id && <Check size={18} />}</button>)}</div>
        <button className="store-apply" type="button" onClick={applyStore}>Áp dụng</button>
      </div>}
      {toast && <div className="store-toast" role="status">{toast}</div>}
    </div>
  );
}