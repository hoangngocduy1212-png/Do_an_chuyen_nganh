import { useState } from 'react';
import { ProductImage } from './ProductImage';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const availableImages = images.length ? images : [''];
  const [selected, setSelected] = useState(0);
  return <div className="product-gallery">
    <div className="product-gallery-main"><ProductImage src={availableImages[selected]} alt={name} /></div>
    {availableImages.length > 1 && <div className="product-gallery-thumbs" aria-label="Ảnh sản phẩm">{availableImages.map((image, index) => <button className={selected === index ? 'selected' : ''} type="button" key={`${image}-${index}`} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}><ProductImage src={image} alt={`${name}, ảnh ${index + 1}`} /></button>)}</div>}
  </div>;
}