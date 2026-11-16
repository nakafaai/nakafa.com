import { Effect, Schema } from "effect";
import type { IntlError } from "use-intl";

/** A message a page could not render: missing from its route's dictionaries, or malformed. */
export class MessageFailure extends Schema.TaggedError<
  MessageFailure,
  { readonly brand: unique symbol }
>()("MessageFailure", { code: Schema.String, message: Schema.String }) {}

/**
 * Reports a message that could not render. Where `strict` holds (in development, in tests, and in the acceptance
 * builds every proof serves) it fails, so a missing message stops the prerender and every suite that meets it. In
 * production it is logged, and the provider draws nothing in its place, never a key path.
 */
export const reportMessage = Effect.fn("i18n.reportMessage")(function* (
  strict: boolean,
  error: IntlError
) {
  const failure = new MessageFailure({
    code: error.code,
    message: error.message,
  });
  if (strict) {
    return yield* failure;
  }
  yield* Effect.logError(failure);
});
