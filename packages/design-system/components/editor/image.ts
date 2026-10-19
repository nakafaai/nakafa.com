import { IMAGE_BYTE_LIMIT, ImageType } from "@repo/editor/image";
import { Option, Schema, String as Str } from "effect";

/** The reason the editor refuses a file before it uploads it. */
export type ImageRefusal = "size" | "type";

/**
 * The reason to refuse a file before its upload, or none when the file may be uploaded. The
 * file's declared type is only a first check: the server reads the file's leading bytes.
 */
export function imageRefusal(file: {
  readonly size: number;
  readonly type: string;
}): Option.Option<ImageRefusal> {
  if (!Schema.is(ImageType)(file.type)) {
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
