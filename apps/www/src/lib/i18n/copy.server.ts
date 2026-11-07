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

/** The locale and namespace of one translator, as the shared server translator takes them. */
type CopyInput = Parameters<typeof readServerTranslator>[0];

/**
 * Reads the translator of one namespace. The namespace stays a type parameter,
 * so the translator is typed for that namespace alone and not for the union of
 * every namespace, which grows past the compiler's depth limit. A copy that
 * cannot load is a typed failure with its cause, so the caller reports it
 * instead of a defect.
 */
export const readCopy = Effect.fn("www.i18n.readCopy")(function* <
  const Namespace extends CopyInput["namespace"],
>(input: {
  readonly locale: CopyInput["locale"];
  readonly namespace: Namespace;
}) {
  return yield* Effect.tryPromise({
    try: () => readServerTranslator(input),
    catch: (cause) =>
      new CopyUnavailableError({ cause, namespace: input.namespace }),
  });
});
