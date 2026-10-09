import { Schema } from "effect";

const MEBIBYTE = 1024 * 1024;

export const NINA_FILE_SIZE = 8 * MEBIBYTE;
export const NINA_FILE_COUNT = 10;
/**
 * Documents travel inside the request body: the gateway accepts 16 MiB and
 * base64 adds a third, so one message keeps its documents to this total.
 */
export const NINA_DOCUMENT_SIZE = 10 * MEBIBYTE;
/** Says that one attachment is empty or larger than the file limit. */
export const NINA_FILE_SIZE_MESSAGE = `Choose a nonempty attachment no larger than ${NINA_FILE_SIZE / MEBIBYTE} MiB.`;
/** Says that the documents of one message are larger together than the document limit. */
export const NINA_DOCUMENT_SIZE_MESSAGE = `The documents in one message can hold at most ${NINA_DOCUMENT_SIZE / MEBIBYTE} MiB together.`;
export const NinaFileType = Schema.Literals([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);
export class NinaUploadError extends Schema.TaggedError<NinaUploadError>()(
  "NinaUploadError",
  {
    code: Schema.Literals([
      "NINA_UPLOAD_INVALID",
      "NINA_UPLOAD_LIMIT",
      "NINA_UPLOAD_FAILED",
      "NINA_UPLOAD_SIZE",
    ]),
    message: Schema.String,
  }
) {}
