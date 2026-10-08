import { NINA_DOCUMENT_SIZE } from "@repo/backend/confect/nina/uploads.spec";
import { Array as Arr } from "effect";

/** Documents are the attachments that are not images. Images reach the model by URL and are not counted. */
function isDocument(file: Pick<File, "type">) {
  return !file.type.startsWith("image/");
}

/**
 * Whether the documents of one message exceed the bytes one request can carry.
 * Images of any size are not counted.
 */
export function exceedsDocumentLimit(
  files: readonly Pick<File, "size" | "type">[]
) {
  const bytes = Arr.reduce(
    Arr.filter(files, isDocument),
    0,
    (total, file) => total + file.size
  );
  return bytes > NINA_DOCUMENT_SIZE;
}
