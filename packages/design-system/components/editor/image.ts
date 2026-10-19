import { Array as Arr, Option, String as Str } from "effect";

/**
 * The most bytes of one image the editor accepts before it uploads anything: 2 MB. The server
 * holds the same limit and checks the file itself, so this check only spares the teacher an
 * upload that the server would refuse.
 */
export const IMAGE_BYTE_LIMIT = 2 * 1024 * 1024;

/** The kinds of file the editor takes as an image. The server reads the file's bytes to decide. */
export const IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

/** The reason the editor refuses a file before it uploads it. */
type ImageRefusal = "size" | "type";

/**
 * The reason to refuse a file before its upload, or none when the file may be uploaded. The
 * file's declared type is only a first check: the server reads the file's leading bytes.
 */
export function imageRefusal(file: {
  readonly size: number;
  readonly type: string;
}): Option.Option<ImageRefusal> {
  if (!Arr.contains(IMAGE_MEDIA_TYPES, file.type)) {
    return Option.some("type");
  }
  if (file.size > IMAGE_BYTE_LIMIT) {
    return Option.some("size");
  }
  return Option.none();
}

/**
 * The alt text that a teacher wrote, trimmed. The contract requires alt text that is not
 * empty, so a blank text is no alt text at all.
 */
export function altText(text: string): Option.Option<string> {
  const trimmed = Str.trim(text);
  return trimmed === "" ? Option.none() : Option.some(trimmed);
}
