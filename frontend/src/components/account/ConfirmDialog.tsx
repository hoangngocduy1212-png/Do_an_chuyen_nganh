import { useEffect, useRef, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({ open, title, description, confirmLabel = 'Xác nhận', onConfirm, onCancel, danger = false, children, confirmDisabled = false, busy = false }: { open: boolean; title: string; description: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; onCancel: () => void; danger?: boolean; children?: ReactNode; confirmDisabled?: boolean; busy?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') ?? [])];
    (dialog?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled):not(.modal-close)') ?? focusable()[0])?.focus();
    function trapFocus(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onCancelRef.current(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); dialog?.focus(); return; }
      if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
    }
    document.addEventListener('keydown', trapFocus);
    return () => { document.removeEventListener('keydown', trapFocus); previousFocusRef.current?.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section ref={dialogRef} className="account-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" tabIndex={-1}><button className="icon-button modal-close" type="button" aria-label="Đóng" onClick={onCancel}><X size={18} /></button><span className={danger ? 'confirm-icon danger' : 'confirm-icon'}><AlertTriangle size={23} /></span><h2 id="confirm-dialog-title">{title}</h2><p>{description}</p>{children}<div><button className="secondary-button" type="button" onClick={onCancel}>Hủy</button><button className={danger ? 'account-danger-button' : 'primary-button'} type="button" disabled={confirmDisabled || busy} onClick={() => void onConfirm()}>{busy ? 'Đang xử lý...' : confirmLabel}</button></div></section></div>;
}