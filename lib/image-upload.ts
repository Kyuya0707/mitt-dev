import "server-only";

import sharp from "sharp";
import {
  ACCEPTED_UPLOAD_IMAGE_TYPES,
  MAX_UPLOAD_IMAGE_BYTES,
  MAX_UPLOAD_IMAGE_COUNT,
} from "@/lib/image-constraints";

type AcceptedImageType = (typeof ACCEPTED_UPLOAD_IMAGE_TYPES)[number];

export type SanitizedUploadImage = {
  buffer: Buffer;
  contentType: AcceptedImageType;
  originalName: string;
};

export class ImageUploadValidationError extends Error {}

function isAcceptedImageType(value: string): value is AcceptedImageType {
  return (ACCEPTED_UPLOAD_IMAGE_TYPES as readonly string[]).includes(value);
}

async function sanitizeImage(file: File): Promise<SanitizedUploadImage> {
  if (!isAcceptedImageType(file.type)) {
    throw new ImageUploadValidationError(
      "画像形式はJPEG・PNG・WebPのみ利用できます"
    );
  }

  if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
    throw new ImageUploadValidationError("画像は1枚5MB以下にしてください");
  }

  const source = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(source, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  }).rotate();

  if (file.type === "image/jpeg") {
    pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
  } else if (file.type === "image/png") {
    pipeline = pipeline.png({ compressionLevel: 9 });
  } else {
    pipeline = pipeline.webp({ quality: 90 });
  }

  try {
    const buffer = await pipeline.toBuffer();
    if (buffer.length > MAX_UPLOAD_IMAGE_BYTES) {
      throw new ImageUploadValidationError(
        "画像処理後のサイズが5MBを超えています"
      );
    }

    return {
      buffer,
      contentType: file.type,
      originalName: file.name,
    };
  } catch (error) {
    if (error instanceof ImageUploadValidationError) {
      throw error;
    }
    throw new ImageUploadValidationError(
      "画像を読み込めませんでした。別の画像を選択してください"
    );
  }
}

export async function sanitizeUploadImages(entries: FormDataEntryValue[]) {
  const files = entries.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );

  if (files.length > MAX_UPLOAD_IMAGE_COUNT) {
    throw new ImageUploadValidationError(
      `画像は最大${MAX_UPLOAD_IMAGE_COUNT}枚までです`
    );
  }

  return Promise.all(files.map(sanitizeImage));
}
