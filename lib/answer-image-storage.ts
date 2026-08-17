import { supabaseServer } from "@/lib/supabase-server";

export const PRIVATE_ANSWER_IMAGE_BUCKET = "answer-images-private";
const STORAGE_PREFIX = "storage://";

export function buildPrivateAnswerImageReference(bucket: string, path: string) {
  return `${STORAGE_PREFIX}${bucket}/${path}`;
}

function parseStorageReference(value: string) {
  if (!value.startsWith(STORAGE_PREFIX)) return null;
  const remainder = value.slice(STORAGE_PREFIX.length);
  const separator = remainder.indexOf("/");
  if (separator <= 0) return null;
  return {
    bucket: remainder.slice(0, separator),
    path: remainder.slice(separator + 1),
  };
}

export async function signAnswerImageReferences<
  T extends { url: string },
>(images: T[]): Promise<T[]> {
  if (images.length === 0) return images;
  const supabase = await supabaseServer();

  return Promise.all(
    images.map(async (image) => {
      const reference = parseStorageReference(image.url);
      if (!reference) {
        return image.url.startsWith("https://") ? image : { ...image, url: "" };
      }

      const { data, error } = await supabase.storage
        .from(reference.bucket)
        .createSignedUrl(reference.path, 5 * 60);

      if (error || !data?.signedUrl) {
        return { ...image, url: "" };
      }
      return { ...image, url: data.signedUrl };
    })
  );
}
