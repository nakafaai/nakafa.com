import { Data } from "effect";

export class InvalidPathError extends Data.TaggedError("InvalidPathError")<{
  readonly path: string;
  readonly reason: string;
}> {}

export class DirectoryReadError extends Data.TaggedError("DirectoryReadError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export class FileReadError extends Data.TaggedError("FileReadError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export class MetadataParseError extends Data.TaggedError("MetadataParseError")<{
  readonly path?: string;
  readonly reason: string;
}> {}

export class ModuleLoadError extends Data.TaggedError("ModuleLoadError")<{
  readonly path: string;
  readonly cause: unknown;
}> {}

export class GitHubFetchError extends Data.TaggedError("GitHubFetchError")<{
  readonly url: string;
  readonly cause: unknown;
}> {}

export class ExerciseLoadError extends Data.TaggedError("ExerciseLoadError")<{
  readonly path: string;
  readonly reason: string;
}> {}

export class ChoicesValidationError extends Data.TaggedError(
  "ChoicesValidationError"
)<{ readonly path: string; readonly errors: unknown }> {}

export class SurahNotFoundError extends Data.TaggedError("SurahNotFoundError")<{
  readonly surahNumber: number;
}> {}

export class VerseNotFoundError extends Data.TaggedError("VerseNotFoundError")<{
  readonly surahNumber: number;
  readonly verseNumber: number;
}> {}
