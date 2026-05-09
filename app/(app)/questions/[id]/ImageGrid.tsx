"use client";

import { useState } from "react";
import Image from "next/image";
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
          <button
            key={img.id}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="relative aspect-square w-full overflow-hidden rounded border transition hover:opacity-80"
          >
            <Image
              src={img.url}
              alt={`回答画像 ${i + 1}`}
              fill
              sizes="(max-width: 640px) 31vw, 180px"
              className="object-cover"
            />
          </button>
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
