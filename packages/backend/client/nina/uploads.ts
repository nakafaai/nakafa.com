import { Schema } from "effect";

const MEBIBYTE = 1024 * 1024;

/** The most MiB one file can hold. The copy that names the limit reads this number. */
export const NINA_FILE_MEBIBYTES = 8;
export const NINA_FILE_SIZE = NINA_FILE_MEBIBYTES * MEBIBYTE;
export const NINA_FILE_COUNT = 10;
/** The most characters the name of one file can hold. A longer name is refused. */
export const NINA_FILENAME_LENGTH = 255;
/**
 * Documents travel inside the request body: the gateway accepts 16 MiB and
 * base64 adds a third, so one message keeps its documents to this many MiB in
 * total. The copy that names the limit reads this number.
 */
export const NINA_DOCUMENT_MEBIBYTES = 10;
export const NINA_DOCUMENT_SIZE = NINA_DOCUMENT_MEBIBYTES * MEBIBYTE;
/** Says that one attachment is empty or larger than the file limit. */
export const NINA_FILE_SIZE_MESSAGE = `Choose a nonempty attachment no larger than ${NINA_FILE_MEBIBYTES} MiB.`;
/** Says that the documents of one message are larger together than the document limit. */
export const NINA_DOCUMENT_SIZE_MESSAGE = `The documents in one message can hold at most ${NINA_DOCUMENT_MEBIBYTES} MiB together.`;
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
