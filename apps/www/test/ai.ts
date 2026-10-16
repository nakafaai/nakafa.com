import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import { createTranslator, type IntlError } from "next-intl";

/** The space that a line never breaks at, which keeps a number with its unit. */
export const NO_BREAK = " ";

/**
 * The translator of Nina's sentences in one language, read from the real
 * dictionary of the app. `onError` hears a sentence that cannot be formatted.
 */
export const aiTranslator = Effect.fn("test.aiTranslator")(function* (
  locale: AppLocaleCode,
  onError?: (error: IntlError) => void
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  return createTranslator({
    locale,
    messages,
    namespace: "Ai",
    ...(onError ? { onError } : {}),
  });
});
