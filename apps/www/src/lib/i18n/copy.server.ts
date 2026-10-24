import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Schema } from "effect";

/** Expected failure while the copy of one translator namespace loads. */
class CopyUnavailableError extends Schema.TaggedError<CopyUnavailableError>()(
  "CopyUnavailableError",
  {
    cause: Schema.Unknown,
    namespace: Schema.String,
  }
) {}

/**
 * Reads the translator of one namespace. A copy that cannot load is a typed
 * failure with its cause, so the caller reports it instead of a defect.
 */
export const readCopy = Effect.fn("www.i18n.readCopy")(function* (
  input: Parameters<typeof readServerTranslator>[0]
) {
  return yield* Effect.tryPromise({
    try: () => readServerTranslator(input),
    catch: (cause) =>
      new CopyUnavailableError({ cause, namespace: input.namespace }),
  });
});
