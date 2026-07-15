import type { FileUIPart } from "ai";
import { Effect, Schema } from "effect";

const PromptInputAttachmentOperationSchema = Schema.Literal(
  "fetch",
  "read-blob",
  "read-data-url"
);

/** An attachment retained by the prompt input while it is being edited. */
export type PromptInputFile = FileUIPart & { id: string };

/** The browser operation that failed while converting one attachment. */
export type PromptInputAttachmentOperation = Schema.Schema.Type<
  typeof PromptInputAttachmentOperationSchema
>;

/** Expected failure raised while converting a browser blob URL for submission. */
export class PromptInputAttachmentConversionError extends Schema.TaggedError<PromptInputAttachmentConversionError>()(
  "PromptInputAttachmentConversionError",
  {
    cause: Schema.Unknown,
    operation: PromptInputAttachmentOperationSchema,
  }
) {}

/** A local file constraint reported before an attachment is accepted. */
export class PromptInputFileConstraintError extends Schema.TaggedError<PromptInputFileConstraintError>()(
  "PromptInputFileConstraintError",
  {
    code: Schema.Literal("max_files", "max_file_size", "accept"),
    message: Schema.String,
  }
) {}

/** Inputs used to validate one picker, paste, or drop operation. */
export interface ValidatePromptInputFilesOptions {
  readonly accept?: string;
  readonly currentFileCount: number;
  readonly files: readonly File[];
  readonly maxFileSize?: number;
  readonly maxFiles?: number;
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

function attachmentConversionError(
  operation: PromptInputAttachmentOperation,
  cause: unknown
) {
  return new PromptInputAttachmentConversionError({ cause, operation });
}

function withoutFileId(file: PromptInputFile): FileUIPart {
  const { id: _id, ...filePart } = file;
  return filePart;
}

/** Reads a blob as a data URL and aborts FileReader work when interrupted. */
const readBlobAsDataUrl = Effect.fn("designSystem.promptInput.readDataUrl")(
  function* (blob: Blob) {
    const reader = yield* Effect.try({
      try: () => new FileReader(),
      catch: (cause) => attachmentConversionError("read-data-url", cause),
    });

    return yield* Effect.async<string, PromptInputAttachmentConversionError>(
      (resume) => {
        function cleanup() {
          reader.removeEventListener("loadend", onLoadEnd);
          reader.removeEventListener("error", onError);
        }

        const onLoadEnd = () => {
          cleanup();
          if (typeof reader.result === "string") {
            resume(Effect.succeed(reader.result));
            return;
          }

          resume(
            Effect.fail(
              attachmentConversionError("read-data-url", reader.result)
            )
          );
        };
        const onError = () => {
          cleanup();
          resume(
            Effect.fail(
              attachmentConversionError(
                "read-data-url",
                reader.error ?? "FileReader failed without an error value."
              )
            )
          );
        };

        reader.addEventListener("loadend", onLoadEnd);
        reader.addEventListener("error", onError);
        reader.readAsDataURL(blob);

        return Effect.sync(() => {
          cleanup();
          if (reader.readyState === FileReader.LOADING) {
            reader.abort();
          }
        });
      }
    );
  }
);

/** Converts local blob URLs while aborting the fetch when the Effect is released. */
const convertFile = Effect.fn("designSystem.promptInput.convertFile")(
  function* (inputFile: PromptInputFile) {
    const file = withoutFileId(inputFile);
    if (!file.url?.startsWith("blob:")) {
      return file;
    }

    const blob = yield* Effect.acquireUseRelease(
      Effect.sync(() => new AbortController()),
      (controller) =>
        Effect.gen(function* () {
          const response = yield* Effect.tryPromise({
            try: () => fetch(file.url, { signal: controller.signal }),
            catch: (cause) => attachmentConversionError("fetch", cause),
          });

          return yield* Effect.tryPromise({
            try: () => response.blob(),
            catch: (cause) => attachmentConversionError("read-blob", cause),
          });
        }),
      (controller) => Effect.sync(() => controller.abort())
    );
    const url = yield* readBlobAsDataUrl(blob);

    return { ...file, url };
  }
);

/** Converts every pending blob attachment into a submission-safe file part. */
export const convertPromptInputFiles = Effect.fn(
  "designSystem.promptInput.convertFiles"
)((files: readonly PromptInputFile[]) =>
  Effect.all(files.map(convertFile), { concurrency: "unbounded" })
);
