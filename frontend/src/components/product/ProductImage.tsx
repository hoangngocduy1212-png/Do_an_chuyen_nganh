import { useEffect, useState } from 'react';
import { Leaf, ShoppingBasket } from 'lucide-react';

export function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src?.trim());
  useEffect(() => { setLoaded(false); setFailed(!src?.trim()); }, [src]);
  return (
    <div className="product-image">
      {!loaded && !failed && <div className="product-image-loading" aria-hidden="true" />}
      {failed ? <div className="product-image-fallback" aria-label={`Ảnh ${alt} không khả dụng`}><ShoppingBasket size={25} /><Leaf size={14} /></div>
        : <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ opacity: loaded ? 1 : 0 }} />}
    </div>
  );
}