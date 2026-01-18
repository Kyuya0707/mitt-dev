"use client";

import { useState } from "react";
import ImageLightbox from "./ImageLightbox";

type ImageItem = {
  id: string;
  url: string;
};

export default function ImageGrid({ images }: { images: ImageItem[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div>
      {/* グリッド表示 */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            onClick={() => setLightboxIndex(i)}
            className="w-full aspect-square object-cover rounded border cursor-pointer hover:opacity-80 transition"
          />
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images.map((img) => img.url)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex(
              (lightboxIndex - 1 + images.length) % images.length
            )
          }
          onNext={() =>
            setLightboxIndex((lightboxIndex + 1) % images.length)
          }
        />
      )}
    </div>
  );
}
