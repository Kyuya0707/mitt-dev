"use client";

import { useState } from "react";
import Image from "next/image";
import ImageLightbox from "./ImageLightbox";

export default function QuestionImages({ images }: { images: { url: string }[] }) {
  const [index, setIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {images.map((img, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className="relative aspect-square w-full overflow-hidden rounded border transition hover:opacity-80"
          >
            <Image
              src={img.url}
              alt={`質問画像 ${i + 1}`}
              fill
              sizes="(max-width: 640px) 31vw, 180px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {index !== null && (
        <ImageLightbox
          images={images.map((img) => img.url)}
          index={index}
          onClose={() => setIndex(null)}
          onPrev={() =>
            setIndex((index - 1 + images.length) % images.length)
          }
          onNext={() => setIndex((index + 1) % images.length)}
        />
      )}
    </>
  );
}
