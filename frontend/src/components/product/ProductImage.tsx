import { useEffect, useState } from 'react';

export function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(!src?.trim());
  useEffect(() => { setLoaded(false); setFailed(!src?.trim()); }, [src]);
  return (
    <div className="product-image">
      {!loaded && !failed && <div className="product-image-loading" aria-hidden="true" />}
      {failed ? <img className="product-image-fallback" src="/product-image-fallback.svg" alt={`Ảnh ${alt} đang được cập nhật`} />
        : <img src={src} alt={alt} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ opacity: loaded ? 1 : 0 }} />}
    </div>
  );
}