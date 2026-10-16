import type { JSONValue } from "ai";
import { Array as Arr, Effect, Result, Schema } from "effect";

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
/**
 * Why a chosen file is not attached: its type is not accepted, it is empty, it
 * is larger than the size limit, or the files already attached leave no room.
 */
const PromptInputFileConstraintCode = Schema.Literals([
  "accept",
  "empty",
  "max_file_size",
  "max_files",
]);
/**
 * A local file constraint reported when files are not attached. `files` names
 * the files that broke it, so one pick reports each reason once. The words that
 * say the reason belong to the caller, in its language, not to this module.
 */
export class PromptInputFileConstraintError extends Schema.TaggedError<PromptInputFileConstraintError>()(
  "PromptInputFileConstraintError",
  {
    code: PromptInputFileConstraintCode,
    files: Schema.Array(Schema.String),
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
  rejections: Schema.Array(PromptInputFileConstraintError),
});
/** The files attached from one picker, paste, or drop, and why the others are not. */
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
/** Splits files into the ones a check keeps and the ones it drops. */
function split(files: readonly File[], isKept: (file: File) => boolean) {
  const [kept, dropped] = Arr.partition(files, (file) =>
    isKept(file) ? Result.succeed(file) : Result.fail(file)
  );
  return { dropped, kept };
}

/** The one rejection that names the dropped files, or none when no file was dropped. */
function reject(
  code: typeof PromptInputFileConstraintCode.Type,
  dropped: readonly File[]
) {
  return Arr.isReadonlyArrayNonEmpty(dropped)
    ? [
        new PromptInputFileConstraintError({
          code,
          files: Arr.map(dropped, (file) => file.name),
        }),
      ]
    : [];
}

/**
 * Validates one incoming prompt-file selection. A file is dropped for the
 * first reason that applies, in this order: its type, an empty file, its size,
 * then the room the attached files leave. The files that pass are kept, and
 * each reason names the files it dropped.
 */
export const validatePromptInputFiles = Effect.fn(
  "designSystem.promptInput.validateFiles"
)(function* ({
  accept,
  currentFileCount,
  files,
  maxFileSize,
  maxFiles,
}: ValidatePromptInputFilesOptions) {
  const typed = split(files, (file) => matchesAccept(file, accept));
  const filled = split(typed.kept, (file) => file.size > 0);
  const sized = split(
    filled.kept,
    (file) => maxFileSize === undefined || file.size <= maxFileSize
  );
  const capacity =
    typeof maxFiles === "number"
      ? Math.max(0, maxFiles - currentFileCount)
      : sized.kept.length;
  return {
    files: Arr.take(sized.kept, capacity),
    rejections: [
      ...reject("accept", typed.dropped),
      ...reject("empty", filled.dropped),
      ...reject("max_file_size", sized.dropped),
      ...reject("max_files", Arr.drop(sized.kept, capacity)),
    ],
  } satisfies PromptInputFileSelection;
});
