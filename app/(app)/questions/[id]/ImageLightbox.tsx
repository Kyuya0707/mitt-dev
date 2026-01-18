"use client";

type Props = {
  images: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function ImageLightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-white text-3xl"
      >
        ×
      </button>

      {/* 左ボタン */}
      <button
        onClick={onPrev}
        className="absolute left-5 text-white text-4xl px-4 py-2"
      >
        ‹
      </button>

      {/* 画像本体 */}
      <img
        src={images[index]}
        className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg"
      />

      {/* 右ボタン */}
      <button
        onClick={onNext}
        className="absolute right-5 text-white text-4xl px-4 py-2"
      >
        ›
      </button>
    </div>
  );
}
