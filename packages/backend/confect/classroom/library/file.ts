import { imageTypeOf } from "@repo/backend/confect/exams/image";
import { Array as Arr, Option } from "effect";

/**
 * The most bytes one file of a class library holds: 20 MiB, the largest PDF a
 * question import reads. A larger video is a link (ADR 0028).
 */
export const LIBRARY_BYTE_LIMIT = 20 * 1024 * 1024;

/** The bytes at the start of a file that `fileTypeOf` reads, which covers every signature. */
export const HEAD_BYTES = 16;

/** The type of a PDF, which the five bytes of `%PDF-` open. */
const PDF_TYPE = "application/pdf";
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

/**
 * The kind of file that the leading bytes of a file name: an image the editor
 * draws, or a PDF. A file whose bytes name neither has none, whatever its name or
 * its declared type says.
 */
export function fileTypeOf(head: Uint8Array) {
  return Option.orElse(imageTypeOf(head), () =>
    Arr.every(PDF_SIGNATURE, (value, index) => head[index] === value)
      ? Option.some(PDF_TYPE)
      : Option.none()
  );
}
