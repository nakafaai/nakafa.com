import { Schema } from "effect";

/** Invalid content path rejected before filesystem or module loading. */
export class InvalidPathError extends Schema.TaggedError<InvalidPathError>()(
  "InvalidPathError",
  {
    message: Schema.String,
    path: Schema.String,
    reason: Schema.String,
  }
) {}

/** Directory read failure while scanning the contents tree. */
export class DirectoryReadError extends Schema.TaggedError<DirectoryReadError>()(
  "DirectoryReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    path: Schema.String,
  }
) {}

/** File read failure while loading a concrete content source file. */
export class FileReadError extends Schema.TaggedError<FileReadError>()(
  "FileReadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    path: Schema.String,
  }
) {}

/** Metadata validation failure for MDX or dynamically imported content. */
export class MetadataParseError extends Schema.TaggedError<MetadataParseError>()(
  "MetadataParseError",
  {
    message: Schema.String,
    path: Schema.optional(Schema.String),
    reason: Schema.String,
  }
) {}

/** Dynamic module import failure for compiled content modules. */
export class ModuleLoadError extends Schema.TaggedError<ModuleLoadError>()(
  "ModuleLoadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    path: Schema.String,
  }
) {}

/** GitHub raw-content fallback failure. */
export class GitHubFetchError extends Schema.TaggedError<GitHubFetchError>()(
  "GitHubFetchError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    url: Schema.String,
  }
) {}

/** Exercise route/source validation failure. */
export class ExerciseLoadError extends Schema.TaggedError<ExerciseLoadError>()(
  "ExerciseLoadError",
  {
    message: Schema.String,
    path: Schema.String,
    reason: Schema.String,
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

/** Quran verse lookup failure for an unknown verse number. */
export class VerseNotFoundError extends Schema.TaggedError<VerseNotFoundError>()(
  "VerseNotFoundError",
  {
    message: Schema.String,
    surahNumber: Schema.Number,
    verseNumber: Schema.Number,
  }
) {}

/** Reference payload validation failure for article citations. */
export class ReferenceParseError extends Schema.TaggedError<ReferenceParseError>()(
  "ReferenceParseError",
  {
    message: Schema.String,
    reason: Schema.String,
  }
) {}
