import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, Check, Clock3, MapPin, Store as StoreIcon } from 'lucide-react';
import { cartApi, type CartResponse } from '../../api/cart';
import { errorMessage } from '../../api/client';
import { membershipsApi } from '../../api/memberships';
import { ordersApi } from '../../api/orders';
import { paymentsApi } from '../../api/payments';
import { storesApi } from '../../api/stores';
import { vouchersApi } from '../../api/vouchers';
import { usersApi, type CustomerAddress } from '../../api/users';
import { AddressForm } from '../../components/account/AddressForm';
import { Breadcrumb } from '../../components/common/Breadcrumb';
import { ConfirmDialog } from '../../components/account/ConfirmDialog';
import { VoucherInput } from '../../components/cart/VoucherInput';
import { OrderSummaryCard } from '../../components/order/OrderSummaryCard';
import { PaymentMethodSelector } from '../../components/order/PaymentMethodSelector';
import { cartStore } from '../../store/cartStore';
import { checkoutStore, useCheckout } from '../../store/checkoutStore';
import { storeSelectionStore, useStoreSelection } from '../../store/storeSelectionStore';
import type { MembershipSummary } from '../../types/user';
import type { PaymentMethod } from '../../types/order';
import type { StoreLocation, Weekday } from '../../types/store';
import { formatMoney } from '../../utils/money';

interface CartChange { name: string; message: string; itemId: string; productId: string; quantity: number; remove: boolean }
const pickupTimes = ['09:00–11:00', '11:00–13:00', '13:00–15:00', '15:00–17:00', '17:00–19:00', '19:00–21:00'];
const weekdayLabels: Array<[Weekday, string]> = [
  ['monday', 'T2'], ['tuesday', 'T3'], ['wednesday', 'T4'], ['thursday', 'T5'],
  ['friday', 'T6'], ['saturday', 'T7'], ['sunday', 'CN'],
];

function formatOpeningHours(openingHours: StoreLocation['openingHours']): string {
  if (typeof openingHours === 'string') return openingHours;
  if (!openingHours) return '08:00–21:00';
  const schedule = weekdayLabels.flatMap(([day, label]) => {
    const hours = openingHours[day];
    return hours && !hours.closed ? [`${label} ${hours.open}–${hours.close}`] : [];
  });
  if (!schedule.length) return 'Đóng cửa';
  const times = new Set(schedule.map((entry) => entry.slice(entry.indexOf(' ') + 1)));
  return times.size === 1 && schedule.length === weekdayLabels.length
    ? `Hằng ngày ${schedule[0].slice(schedule[0].indexOf(' ') + 1)}`
    : schedule.join(' · ');
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const selection = useStoreSelection();
  const checkout = useCheckout();
  const [cart, setCart] = useState<CartResponse>();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [stores, setStores] = useState<StoreLocation[]>([]);
  const [membership, setMembership] = useState<MembershipSummary>();
  const [availableVouchers, setAvailableVouchers] = useState<Array<{ voucherId: string; code: string; discountValue: number; minimumOrder: number; startDate: string; endDate: string }>>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [serviceable, setServiceable] = useState(true);
  const [shippingFee, setShippingFee] = useState(20000);
  const [checkingService, setCheckingService] = useState(false);
  const [showCartChanges, setShowCartChanges] = useState(false);
  const [cartChanges, setCartChanges] = useState<CartChange[]>([]);
  const [compactSummaryOpen, setCompactSummaryOpen] = useState(false);

  const store = stores.find((item) => item._id === selection.storeId);
  const amount = cart?.items.reduce((sum, item) => sum + (item.product.salePrice ?? item.product.price) * item.quantity, 0) ?? 0;
  const weighted = Boolean(cart?.items.some((item) => item.product.unit === 'kg'));
  const total = Math.max(0, amount - checkout.discountAmount) + (checkout.receiveMethod === 'DELIVERY' ? shippingFee : 0);
  const points = Math.floor(total / 10000);
  const selectedAddress = addresses.find((address) => address.addressId === checkout.addressId);

  useEffect(() => {
    if (!checkout.initialized) checkoutStore.update({ initialized: true, receiveMethod: selection.receiveMethod, shippingAddress: selection.deliveryAddress });
  }, [checkout.initialized, selection.receiveMethod, selection.deliveryAddress]);

  const refreshCart = useCallback(async () => {
    const response = await cartApi.get(selection.storeId);
    setCart(response);
    cartStore.replace(response.items);
    return response;
  }, [selection.storeId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      refreshCart(), usersApi.addresses().catch(() => []), storesApi.list().catch(() => []), membershipsApi.me().catch(() => undefined),
      vouchersApi.available().catch(() => []),
    ]).then(([cartData, addressData, storeData, membershipData, voucherData]) => {
      if (!active) return;
      setCart(cartData); setAddresses(addressData); setStores(storeData); setMembership(membershipData); setAvailableVouchers(voucherData);
      if (!checkout.addressId || !checkout.initialized) {
        const defaultAddress = addressData.find((address) => address.isDefault);
        if (defaultAddress && !checkout.addressId && !checkout.recipientName && !checkout.recipientPhone) checkoutStore.update({ addressId: defaultAddress.addressId, shippingAddress: checkout.shippingAddress || defaultAddress.addressLine, recipientName: defaultAddress.recipientName, recipientPhone: defaultAddress.phoneNumber });
      }
    }).catch(() => { if (active) setError('Không thể tải giỏ hàng. Dữ liệu thanh toán của bạn vẫn được giữ lại.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshCart]);

  useEffect(() => {
    if (checkout.receiveMethod !== selection.receiveMethod) storeSelectionStore.setReceiveMethod(checkout.receiveMethod);
  }, [checkout.receiveMethod, selection.receiveMethod]);

  useEffect(() => {
    if (checkout.receiveMethod !== 'DELIVERY' || !checkout.shippingAddress.trim()) { setServiceable(true); setCheckingService(false); return; }
    let active = true;
    setCheckingService(true);
    const timer = window.setTimeout(() => {
      storesApi.checkDelivery(selection.storeId, checkout.shippingAddress).then((result) => {
        if (active) { setServiceable(result.serviceable); setShippingFee(result.estimatedFee); }
      }).finally(() => { if (active) setCheckingService(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [checkout.receiveMethod, checkout.shippingAddress, selection.storeId]);

  const setField = (patch: Parameters<typeof checkoutStore.update>[0]) => checkoutStore.update(patch);
  function chooseReceiveMethod(method: 'DELIVERY' | 'PICKUP') {
    checkoutStore.update({ receiveMethod: method });
    storeSelectionStore.setReceiveMethod(method);
  }
  function chooseAddress(address: CustomerAddress) {
    checkoutStore.update({ addressId: address.addressId, shippingAddress: address.addressLine, recipientName: address.recipientName, recipientPhone: address.phoneNumber });
  }
  async function saveAddress(input: Omit<CustomerAddress, 'addressId'>) {
    setSavingAddress(true);
    try {
      const address = await usersApi.createAddress(input);
      setAddresses((current) => [...current, address]); chooseAddress(address); setShowAddressForm(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể lưu địa chỉ.'); }
    finally { setSavingAddress(false); }
  }
  async function applyVoucher(code: string, discount: number) { checkoutStore.applyVoucher(code, discount); setError(''); setErrorCode(''); }
  async function selectVoucher(code: string) {
    try {
      const result = await vouchersApi.validate(code, amount);
      checkoutStore.applyVoucher(code, result.discountAmount); setError(''); setErrorCode('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể áp dụng voucher.'); }
  }

  async function inspectCart(): Promise<CartChange[]> {
    const validation = await cartApi.validate(selection.storeId);
    return validation.changes.map((change) => ({
      itemId: change.itemId,
      productId: change.productId,
      name: change.productName,
      message: change.message,
      quantity: change.suggestedQuantity,
      remove: change.type === 'UNAVAILABLE',
    }));
  }

  async function placeOrder() {
    if (!cart?.items.length || submitting || (checkout.receiveMethod === 'DELIVERY' && (!checkout.shippingAddress.trim() || !checkout.recipientName.trim() || !checkout.recipientPhone.trim() || !serviceable))) return;
    if (checkout.receiveMethod === 'DELIVERY' && !/^0\d{9}$/.test(checkout.recipientPhone.replace(/\s/g, ''))) { setError('Số điện thoại người nhận phải có 10 số và bắt đầu bằng 0.'); setErrorCode('VALIDATION'); return; }
    if (checkout.receiveMethod === 'DELIVERY' && checkout.shippingAddress.trim().length < 12) { setError('Vui lòng nhập địa chỉ nhận hàng đầy đủ.'); setErrorCode('VALIDATION'); return; }
    setSubmitting(true); setError(''); setErrorCode('');
    try {
      const changes = await inspectCart();
      if (changes.length) { setCartChanges(changes); setShowCartChanges(true); setSubmitting(false); return; }
      await submitConfirmedOrder();
    } catch (reason) {
      setError('Không thể kết nối, vui lòng thử lại.'); setSubmitting(false);
      if (reason instanceof Error) setErrorCode((reason as Error & { code?: string }).code ?? 'NETWORK');
    }
  }

  async function submitConfirmedOrder() {
    setSubmitting(true); setError(''); setErrorCode('');
    try {
      const order = await ordersApi.create({
        storeId: selection.storeId,
        receiveMethod: checkout.receiveMethod,
        shippingAddress: checkout.receiveMethod === 'DELIVERY' ? checkout.shippingAddress : undefined,
        recipientName: checkout.receiveMethod === 'DELIVERY' ? checkout.recipientName : undefined,
        recipientPhone: checkout.receiveMethod === 'DELIVERY' ? checkout.recipientPhone : undefined,
        pickupTime: checkout.receiveMethod === 'PICKUP' ? checkout.pickupTime : undefined,
        pickupNote: checkout.receiveMethod === 'PICKUP' ? checkout.pickupNote : undefined,
        note: [checkout.orderNote, checkout.receiveMethod === 'PICKUP' ? checkout.pickupNote : ''].filter(Boolean).join(' · ') || undefined,
        voucherCode: checkout.voucherCode || undefined,
      }, checkoutStore.getIdempotencyKey(), total);
      checkoutStore.setOrderPaymentMethod(order.orderId, checkout.paymentMethod);
      await cartApi.clear(); cartStore.clear();
      if (checkout.paymentMethod === 'CASH') {
        checkoutStore.resetAfterOrder();
        navigate(`/orders/${order.orderId}/success`);
        return;
      }
      try {
        const payment = await paymentsApi.create(order.orderId, checkout.paymentMethod, order.totalAmount);
        checkoutStore.setPayment(order.orderId, payment);
        checkoutStore.resetAfterOrder();
        if (payment.paymentUrl) { window.location.assign(payment.paymentUrl); return; }
      } catch {
        checkoutStore.resetAfterOrder();
        navigate(`/payment/${order.orderId}`);
        return;
      }
      navigate(`/payment/${order.orderId}`);
    } catch (reason) {
      const orderError = reason instanceof Error ? reason as Error & { code?: string; details?: Array<{ productName: string; requestedQuantity: number; availableStock: number }> } : undefined;
      const code = orderError?.code;
      setErrorCode(code ?? 'NETWORK');
      if (code === 'OUT_OF_STOCK') {
        const missing = orderError?.details?.map((item) => `${item.productName} (còn ${item.availableStock}/${item.requestedQuantity})`).join(', ');
        setError(missing ? `Sản phẩm không đủ hàng: ${missing}. Vui lòng kiểm tra lại giỏ hàng.` : 'Một số sản phẩm vừa hết hàng. Vui lòng kiểm tra lại giỏ hàng.');
      }
      else if (code === 'VOUCHER_INVALID') setError('Voucher không còn hợp lệ. Hãy chọn mã khác.');
      else if (reason instanceof Error && reason.message) setError(reason.message);
      else setError('Không thể kết nối, vui lòng thử lại');
      if (code === 'OUT_OF_STOCK') setErrorCode('OUT_OF_STOCK');
    } finally { setSubmitting(false); }
  }

  async function confirmCartChanges() {
    setShowCartChanges(false); setSubmitting(true);
    try {
      for (const change of cartChanges) {
        if (change.remove) await cartApi.remove(change.itemId);
        else await cartApi.update(change.itemId, change.quantity);
      }
      const latest = await refreshCart();
      setCartChanges([]);
      if (!latest.items.length) { setError('Giỏ hàng hiện không còn sản phẩm khả dụng.'); setSubmitting(false); return; }
      await submitConfirmedOrder();
    } catch { setError('Không thể cập nhật giỏ hàng. Vui lòng thử lại.'); setSubmitting(false); }
  }

  const unavailableVoucher = (voucher: typeof availableVouchers[number]) => amount < voucher.minimumOrder ? `Đơn hàng chưa đạt tối thiểu ${formatMoney(voucher.minimumOrder)}` : '';
  const orderButtonDisabled = loading || submitting || !cart?.items.length || (checkout.receiveMethod === 'DELIVERY' && (!checkout.shippingAddress.trim() || !checkout.recipientName.trim() || !checkout.recipientPhone.trim() || !serviceable || checkingService)) || (checkout.receiveMethod === 'PICKUP' && !checkout.pickupTime);
  const steps = useMemo(() => ['Hình thức nhận hàng', 'Thông tin nhận hàng', 'Ghi chú đơn hàng', 'Voucher và điểm', 'Phương thức thanh toán'], []);

  return <div className="customer-shell checkout-page">
    <Breadcrumb items={[{ label: 'Giỏ hàng', to: '/cart' }, { label: 'Thanh toán' }]} />
    <header className="listing-heading"><span className="section-eyebrow">HOÀN TẤT ĐẶT HÀNG</span><h1>Thanh toán</h1><p>Kiểm tra thông tin nhận hàng và phương thức thanh toán.</p></header>
    {error && <div className={`checkout-error ${errorCode === 'OUT_OF_STOCK' ? 'checkout-error-stock' : ''}`} role="alert"><span>{error}</span>{errorCode === 'OUT_OF_STOCK' && <Link to="/cart">Quay lại giỏ hàng</Link>}</div>}
    {loading ? <div className="cart-loading" aria-label="Đang tải thanh toán"><i /><i /></div> : !cart?.items.length ? <div className="listing-message"><strong>Giỏ hàng đang trống</strong><p>Thêm sản phẩm vào giỏ trước khi thanh toán.</p><Link to="/products">Tiếp tục mua sắm</Link></div> : <div className="checkout-layout">
      <section className="checkout-fields">
        <ol className="checkout-step-list">{steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
        <section className="checkout-section"><h2><span className="checkout-step-number">1</span>Hình thức nhận hàng</h2><div className="checkout-receive checkout-receive-cards">
          <label className={checkout.receiveMethod === 'DELIVERY' ? 'selected' : ''}><input type="radio" name="receive-method" checked={checkout.receiveMethod === 'DELIVERY'} onChange={() => chooseReceiveMethod('DELIVERY')} /><MapPin size={20} /><span><strong>Giao tận nơi</strong><small>Giao từ chi nhánh bạn chọn</small></span></label>
          <label className={checkout.receiveMethod === 'PICKUP' ? 'selected' : ''}><input type="radio" name="receive-method" checked={checkout.receiveMethod === 'PICKUP'} onChange={() => chooseReceiveMethod('PICKUP')} /><StoreIcon size={20} /><span><strong>Nhận tại cửa hàng</strong><small>Đặt trước, đến lấy, thường sẵn sàng sau 1–2 giờ</small></span></label>
        </div></section>

        <section className="checkout-section"><h2><span className="checkout-step-number">2</span>Thông tin nhận hàng</h2>
          {checkout.receiveMethod === 'DELIVERY' ? <>
            <div className="checkout-address-list">{addresses.map((address) => <label className={`checkout-address-option ${checkout.addressId === address.addressId ? 'selected' : ''}`} key={address.addressId}><input type="radio" name="saved-address" checked={checkout.addressId === address.addressId} onChange={() => chooseAddress(address)} /><span><strong>{address.label} · {address.recipientName}</strong><small>{address.phoneNumber}</small><small>{address.addressLine}</small></span>{address.isDefault && <em>Mặc định</em>}</label>)}
              <button className="add-address-toggle" type="button" onClick={() => setShowAddressForm((value) => !value)}>{showAddressForm ? 'Đóng biểu mẫu' : '+ Thêm địa chỉ mới'}</button>
            </div>
            {showAddressForm && <AddressForm onSave={saveAddress} onCancel={() => setShowAddressForm(false)} />}
            <div className="checkout-recipient-fields"><label className="checkout-label">Người nhận<input value={checkout.recipientName} onChange={(event) => setField({ recipientName: event.target.value })} autoComplete="name" /></label><label className="checkout-label">Số điện thoại<input value={checkout.recipientPhone} onChange={(event) => setField({ recipientPhone: event.target.value })} autoComplete="tel" inputMode="tel" /></label><label className="checkout-label checkout-address-edit">Địa chỉ<textarea value={checkout.shippingAddress} onChange={(event) => setField({ addressId: '', shippingAddress: event.target.value })} autoComplete="street-address" /></label></div>
            <div className="checkout-delivery-meta"><span><MapPin size={15} />Giao từ {store?.name ?? 'chi nhánh đang chọn'}</span><span>Phí vận chuyển ước tính: {checkingService ? 'Đang tính...' : serviceable ? formatMoney(shippingFee) : 'Chưa phục vụ'}</span></div>
            {!serviceable && <div className="serviceability-warning" role="alert"><strong>Cửa hàng này chưa giao tới địa chỉ của bạn</strong><span>Đổi cửa hàng hoặc chọn Nhận tại cửa hàng.</span><button type="button" onClick={() => window.dispatchEvent(new Event('muadee:open-store-selector'))}>Đổi cửa hàng</button><button type="button" onClick={() => chooseReceiveMethod('PICKUP')}>Chọn nhận tại cửa hàng</button></div>}
          </> : <div className="checkout-pickup-details"><div className="pickup-store-info"><StoreIcon size={18} /><div><strong>{store?.name ?? 'Chi nhánh đang chọn'}</strong><span>{store?.address ?? 'Địa chỉ cửa hàng đang cập nhật'}</span><span>{store?.phoneNumber ?? 'Liên hệ cửa hàng để biết thêm thông tin'}</span><span>Giờ mở cửa: {formatOpeningHours(store?.openingHours)}</span></div></div><label className="checkout-label">Khung giờ đến lấy<select value={checkout.pickupTime} onChange={(event) => setField({ pickupTime: event.target.value })}><option value="">Chọn khung giờ</option>{pickupTimes.map((time) => <option value={time} key={time}>{time}</option>)}</select></label><label className="checkout-label">Ghi chú khi nhận hàng<textarea value={checkout.pickupNote} maxLength={200} onChange={(event) => setField({ pickupNote: event.target.value })} placeholder="Ví dụ: Tôi sẽ đến nhận sau giờ làm" /></label><small className="pickup-ready-note"><Clock3 size={14} />Đơn thường sẵn sàng sau 1–2 giờ</small></div>}
        </section>

        <section className="checkout-section"><h2><span className="checkout-step-number">3</span>Ghi chú đơn hàng <small>(tùy chọn)</small></h2><label className="checkout-label"><textarea maxLength={200} value={checkout.orderNote} onChange={(event) => setField({ orderNote: event.target.value })} placeholder="Lời nhắn cho cửa hàng (tối đa 200 ký tự)" /><span className="checkout-character-count">{checkout.orderNote.length}/200</span></label></section>

        <section className="checkout-section"><h2><span className="checkout-step-number">4</span>Voucher và điểm</h2><VoucherInput amount={amount} voucher={checkout.voucherCode ? { code: checkout.voucherCode, discount: checkout.discountAmount } : undefined} onApplied={applyVoucher} onRemove={() => checkoutStore.clearVoucher()} /><div className="quick-vouchers-heading">Voucher khả dụng</div><div className="quick-vouchers">{availableVouchers.map((voucher) => { const reason = unavailableVoucher(voucher); const selected = checkout.voucherCode === voucher.code; return <button type="button" key={voucher.voucherId} disabled={Boolean(reason)} className={`${reason ? 'unavailable' : ''} ${selected ? 'selected' : ''}`} onClick={() => void selectVoucher(voucher.code)}><span><strong>{voucher.code}</strong><small>Giảm {formatMoney(voucher.discountValue)} · Đơn từ {formatMoney(voucher.minimumOrder)}</small>{reason && <em>{reason}</em>}</span>{selected && <Check size={17} />}</button>; })}{!availableVouchers.length && <span className="checkout-no-vouchers">Hiện chưa có voucher khả dụng.</span>}</div><div className="member-points-line"><Banknote size={16} /><span>{membership ? `Thành viên ${membership.memberLevel}` : 'Điểm thành viên'} · dự kiến nhận <strong>{points.toLocaleString('vi-VN')} điểm</strong> sau khi đơn hàng giao thành công</span></div></section>

        <section className="checkout-section"><h2><span className="checkout-step-number">5</span>Phương thức thanh toán</h2><PaymentMethodSelector value={checkout.paymentMethod as PaymentMethod} onChange={(paymentMethod) => setField({ paymentMethod })} pickup={checkout.receiveMethod === 'PICKUP'} />{weighted && <div className="weighted-order-notice">Đơn có hàng bán theo cân. Số tiền cuối cùng được tính theo khối lượng thực tế; phần chênh lệch sẽ được hoàn lại hoặc thu thêm khi giao nhận.</div>}</section>
      </section>

      <div className="checkout-summary-column"><button className="checkout-summary-toggle" type="button" aria-expanded={compactSummaryOpen} onClick={() => setCompactSummaryOpen((value) => !value)}>{compactSummaryOpen ? 'Thu gọn tóm tắt' : `Tóm tắt đơn hàng · ${formatMoney(total)}`}</button><div className={compactSummaryOpen ? 'checkout-summary-expanded' : 'checkout-summary-collapsed'}><OrderSummaryCard cart={cart} shippingFee={checkout.receiveMethod === 'DELIVERY' ? shippingFee : 0} points={points} />{checkout.voucherCode && <div className="checkout-summary-voucher">Mã {checkout.voucherCode} · Giảm {formatMoney(checkout.discountAmount)}</div>}</div><button className="checkout-submit checkout-submit-desktop" disabled={orderButtonDisabled} onClick={() => void placeOrder()}>{submitting ? 'Đang tạo đơn...' : `Đặt hàng · ${formatMoney(total)}`}</button><Link className="checkout-back" to="/cart">Quay lại giỏ hàng</Link></div>
    </div>}
    {cartChanges.length > 0 && <ConfirmDialog open={showCartChanges} title="Giỏ hàng có thay đổi" description="Tồn kho hoặc giá sản phẩm vừa thay đổi. Xác nhận để cập nhật giỏ hàng và tiếp tục đặt đơn." confirmLabel="Xác nhận thay đổi" onCancel={() => setShowCartChanges(false)} onConfirm={confirmCartChanges} busy={submitting}><ul className="cart-change-list">{cartChanges.map((change) => <li key={change.itemId}><strong>{change.name}</strong><span>{change.message}</span></li>)}</ul></ConfirmDialog>}
    {cart?.items.length ? <div className="checkout-fixed-action"><button className="checkout-submit" disabled={orderButtonDisabled} onClick={() => void placeOrder()}>{submitting ? 'Đang tạo đơn...' : `Đặt hàng · ${formatMoney(total)}`}</button></div> : null}
  </div>;
}
