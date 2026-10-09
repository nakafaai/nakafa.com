import type { JSONValue } from "ai";
import { Array as Arr, Effect, Schema } from "effect";

/** JSON value typed exactly as the AI SDK's `JSONValue`. */
const JsonValueSchema: Schema.Codec<JSONValue> = Schema.suspend(() =>
  Schema.Union([
    Schema.Null,
    Schema.String,
    Schema.Finite,
    Schema.Boolean,
    JsonObjectSchema,
    Schema.Array(JsonValueSchema),
  ])
);
/** JSON object whose members may be `undefined`, as the AI SDK's `JSONObject`. */
const JsonObjectSchema = Schema.Record(
  Schema.String,
  Schema.UndefinedOr(JsonValueSchema)
);
/** Provider file ids keyed by provider; `type` stays absent, as the AI SDK requires. */
const ProviderReferenceSchema = Schema.StructWithRest(
  Schema.Struct({ type: Schema.optionalKey(Schema.Never) }),
  [Schema.Record(Schema.String, Schema.String)]
);
export const PromptInputFileSchema = Schema.Struct({
  file: Schema.instanceOf(File),
  filename: Schema.optionalKey(Schema.String),
  id: Schema.String,
  mediaType: Schema.String,
  providerMetadata: Schema.optionalKey(
    Schema.Record(Schema.String, JsonObjectSchema)
  ),
  providerReference: Schema.optionalKey(ProviderReferenceSchema),
  type: Schema.Literal("file"),
  url: Schema.String,
});
/** A selected browser file with an input-owned preview. */
export type PromptInputFile = typeof PromptInputFileSchema.Type;
/** A local file constraint reported before an attachment is accepted. */
export class PromptInputFileConstraintError extends Schema.TaggedError<PromptInputFileConstraintError>()(
  "PromptInputFileConstraintError",
  {
    code: Schema.Literals(["max_files", "max_file_size", "accept"]),
    message: Schema.String,
  }
) {}
const ValidatePromptInputFilesOptionsSchema = Schema.Struct({
  accept: Schema.optional(Schema.String),
  currentFileCount: Schema.Finite,
  files: Schema.Array(Schema.instanceOf(File)),
  maxFileSize: Schema.optional(Schema.Finite),
  maxFiles: Schema.optional(Schema.Finite),
});
/** Inputs used to validate one picker, paste, or drop operation. */
type ValidatePromptInputFilesOptions =
  typeof ValidatePromptInputFilesOptionsSchema.Type;
const PromptInputFileSelectionSchema = Schema.Struct({
  files: Schema.Array(Schema.instanceOf(File)),
  warning: Schema.optionalKey(PromptInputFileConstraintError),
});
/** Files accepted from one picker, paste, or drop operation. */
type PromptInputFileSelection = typeof PromptInputFileSelectionSchema.Type;
/** Matches HTML accept syntax for extensions, exact MIME types, and MIME wildcards. */
function matchesAccept(file: File, accept?: string) {
  if (!accept || accept.trim() === "") {
    return true;
  }
  const filename = file.name.toLowerCase();
  const mediaType = file.type.toLowerCase();
  const specifiers = Arr.filter(
    Arr.map(accept.split(","), (specifier) => specifier.trim().toLowerCase()),
    Boolean
  );
  return Arr.some(specifiers, (specifier) => {
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
  const accepted = Arr.filter(files, (file) => matchesAccept(file, accept));
  if (files.length > 0 && accepted.length === 0) {
    return yield* new PromptInputFileConstraintError({
      code: "accept",
      message: "No files match the accepted types.",
    });
  }
  const sized = Arr.filter(
    accepted,
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
    files: Arr.take(sized, capacity),
    warning: new PromptInputFileConstraintError({
      code: "max_files",
      message: "Too many files. Some were not added.",
    }),
  } satisfies PromptInputFileSelection;
});
