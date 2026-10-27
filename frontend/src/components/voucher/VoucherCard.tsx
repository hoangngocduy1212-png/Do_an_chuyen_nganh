import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Voucher } from '../../types/voucher';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function VoucherCard({ voucher, expiring = false }: { voucher: Voucher; expiring?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyCode() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(voucher.code);
      else throw new Error('clipboard-unavailable');
    } catch {
      const field = document.createElement('textarea');
      field.value = voucher.code;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
    }
    setCopied(true);
  }

  return <article className={`voucher-card ${expiring ? 'expiring' : ''}`}>
    <div className="voucher-card-icon"><Tag size={22} /></div>
    <div className="voucher-card-details"><span className="voucher-card-code">Mã {voucher.code}</span><h2>Giảm {voucher.discountValue.toLocaleString('vi-VN')}đ</h2><p>Cho đơn từ {voucher.minimumOrder.toLocaleString('vi-VN')}đ</p><small>HSD {formatDate(voucher.endDate)}</small></div>
    <div className="voucher-card-actions"><button className="voucher-copy" type="button" onClick={copyCode}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Đã sao chép' : 'Sao chép mã'}</button><Link className="voucher-use" to="/products">Dùng ngay <ArrowRight size={15} /></Link></div>
  </article>;
}