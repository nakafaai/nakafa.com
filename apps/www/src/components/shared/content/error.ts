import { Schema } from "effect";

/** The reviewed source for a content page could not be copied. */
export class OpenContentCopyError extends Schema.TaggedError<
  OpenContentCopyError,
  { readonly brand: unique symbol }
>()("OpenContentCopyError", {
  code: Schema.Literals([
    "OPEN_CONTENT_SOURCE_MISSING",
    "OPEN_CONTENT_SOURCE_FETCH_FAILED",
    "OPEN_CONTENT_SOURCE_REJECTED",
    "OPEN_CONTENT_SOURCE_READ_FAILED",
    "OPEN_CONTENT_SOURCE_EMPTY",
    "OPEN_CONTENT_CLIPBOARD_FAILED",
  ]),
  message: Schema.String,
}) {}
