import { Array as Arr, Option, Schema } from "effect";

/** The largest file an import reads: 20 MB, as the blueprint sets. */
export const IMPORT_BYTE_LIMIT = 20 * 1024 * 1024;

/** The most pages of a PDF one import reads. */
export const IMPORT_PAGE_LIMIT = 30;

/** The files the file picker offers: Word documents and PDFs. The bytes decide, not the name. */
export const IMPORT_ACCEPT =
  ".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Why the browser refuses a file before any of it is sent: it is no PDF or Word document, it
 * is larger than 20 MB, its PDF has more than 30 pages, its Word document carries macros, or its
 * PDF needs a password.
 */
export class ImportFileRefused extends Schema.TaggedError<ImportFileRefused>()(
  "ImportFileRefused",
  {
    reason: Schema.Literals(["type", "size", "pages", "macro", "encrypted"]),
  }
) {}

/** The bytes a PDF starts with: `%PDF-`. */
const PDF_HEAD = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** The bytes a ZIP file starts with, which a Word document is. */
const ZIP_HEAD = [0x50, 0x4b, 0x03, 0x04];

/** Whether the bytes start with this signature. */
const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  bytes.length >= signature.length &&
  Arr.every(signature, (byte, index) => bytes[index] === byte);

/**
 * The kind of a file from its leading bytes: a PDF, or a ZIP that may hold a Word document.
 * Any other file is none, whatever its name says.
 */
export const fileKindOf = (head: Uint8Array): Option.Option<"pdf" | "zip"> => {
  if (startsWith(head, PDF_HEAD)) {
    return Option.some("pdf");
  }
  return startsWith(head, ZIP_HEAD) ? Option.some("zip") : Option.none();
};

/**
 * The title a new exam takes from the file it is imported from: the file's name without its
 * extension, trimmed, or none when the name holds nothing else.
 */
export const titleOfFile = (name: string): Option.Option<string> => {
  const dot = name.lastIndexOf(".");
  const title = (dot > 0 ? name.slice(0, dot) : name).trim();
  return title === "" ? Option.none() : Option.some(title);
};
