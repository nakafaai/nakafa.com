import type { FileUIPart } from "ai";
import { Effect, Schema } from "effect";

/** A selected browser file with an input-owned preview. */
export type PromptInputFile = FileUIPart & { id: string; file: File };
/** A local file constraint reported before an attachment is accepted. */
export class PromptInputFileConstraintError extends Schema.TaggedError<PromptInputFileConstraintError>()(
  "PromptInputFileConstraintError",
  {
    code: Schema.Literals(["max_files", "max_file_size", "accept"]),
    message: Schema.String,
  }
) {}
/** Inputs used to validate one picker, paste, or drop operation. */
export interface ValidatePromptInputFilesOptions {
  readonly accept?: string | undefined;
  readonly currentFileCount: number;
  readonly files: readonly File[];
  readonly maxFileSize?: number | undefined;
  readonly maxFiles?: number | undefined;
}
/** Files accepted from one picker, paste, or drop operation. */
export interface PromptInputFileSelection {
  readonly files: File[];
  readonly warning?: PromptInputFileConstraintError;
}
/** Matches HTML accept syntax for extensions, exact MIME types, and MIME wildcards. */
function matchesAccept(file: File, accept?: string) {
  if (!accept || accept.trim() === "") {
    return true;
  }
  const filename = file.name.toLowerCase();
  const mediaType = file.type.toLowerCase();
  const specifiers = accept
    .split(",")
    .map((specifier) => specifier.trim().toLowerCase())
    .filter(Boolean);
  return specifiers.some((specifier) => {
    if (specifier.startsWith(".")) {
      return filename.endsWith(specifier);
    }
    if (specifier.endsWith("/*")) {
      return mediaType.startsWith(specifier.slice(0, -1));
    }
    return mediaType === specifier;
  });
}
/** Validates and caps one incoming prompt-file selection. */
export const validatePromptInputFiles = Effect.fn(
  "designSystem.promptInput.validateFiles"
)(function* ({
  accept,
  currentFileCount,
  files,
  maxFileSize,
  maxFiles,
}: ValidatePromptInputFilesOptions) {
  const accepted = files.filter((file) => matchesAccept(file, accept));
  if (files.length > 0 && accepted.length === 0) {
    return yield* new PromptInputFileConstraintError({
      code: "accept",
      message: "No files match the accepted types.",
    });
  }
  const sized = accepted.filter(
    (file) => maxFileSize === undefined || file.size <= maxFileSize
  );
  if (accepted.length > 0 && sized.length === 0) {
    return yield* new PromptInputFileConstraintError({
      code: "max_file_size",
      message: "All files exceed the maximum size.",
    });
  }
  const capacity =
    typeof maxFiles === "number"
      ? Math.max(0, maxFiles - currentFileCount)
      : undefined;
  if (capacity === undefined || sized.length <= capacity) {
    return { files: sized } satisfies PromptInputFileSelection;
  }
  return {
    files: sized.slice(0, capacity),
    warning: new PromptInputFileConstraintError({
      code: "max_files",
      message: "Too many files. Some were not added.",
    }),
  } satisfies PromptInputFileSelection;
});
