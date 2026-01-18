"use client";

import { useState } from "react";
import ImageLightbox from "./ImageLightbox";

export default function QuestionImages({ images }: { images: { url: string }[] }) {
  const [index, setIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {images.map((img, i) => (
          <img
            key={i}
            src={img.url}
            onClick={() => setIndex(i)}
            className="w-full aspect-square object-cover rounded border cursor-pointer hover:opacity-80 transition"
          />
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
