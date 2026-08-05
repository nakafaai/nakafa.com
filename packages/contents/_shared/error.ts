import { Schema } from "effect";

/** Directory read failure while scanning the contents tree. */
export class DirectoryReadError extends Schema.TaggedError<DirectoryReadError>()(
  "DirectoryReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    path: Schema.String,
  }
) {}

/** Localized MDX paths that drift from the canonical locale corpus. */
export class MdxLocaleParityError extends Schema.TaggedError<MdxLocaleParityError>()(
  "MdxLocaleParityError",
  {
    locale: Schema.String,
    message: Schema.String,
    missingSlugs: Schema.Array(Schema.String),
    unexpectedSlugs: Schema.Array(Schema.String),
  }
) {}
