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

/** Quran surah lookup failure for an unknown surah number. */
export class SurahNotFoundError extends Schema.TaggedError<SurahNotFoundError>()(
  "SurahNotFoundError",
  {
    message: Schema.String,
    surahNumber: Schema.Number,
  }
) {}

/** Quran source rows that fail the canonical corpus contract. */
export class QuranCorpusError extends Schema.TaggedError<QuranCorpusError>()(
  "QuranCorpusError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
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
