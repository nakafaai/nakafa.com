import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import { createTranslator, type IntlError } from "next-intl";

/** The no-break space, which keeps a number with its unit on one line. */
export const NO_BREAK = " ";

/**
 * The translator of one dictionary namespace in one language, read from the
 * real dictionary of the app. `onError` hears a sentence that cannot be formatted.
 */
const dictionaryTranslator = Effect.fn("test.dictionaryTranslator")(function* (
  namespace: "Ai" | "Toast",
  locale: AppLocaleCode,
  onError?: (error: IntlError) => void
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  return createTranslator({
    locale,
    messages,
    namespace,
    ...(onError ? { onError } : {}),
  });
});

/** The translator of Nina's sentences in one language. */
export const aiTranslator = Effect.fn("test.aiTranslator")(function* (
  locale: AppLocaleCode,
  onError?: (error: IntlError) => void
) {
  return yield* dictionaryTranslator("Ai", locale, onError);
});

/** The translator of the toast copy in one language, which the failure sentences share. */
export const toastTranslator = Effect.fn("test.toastTranslator")(function* (
  locale: AppLocaleCode,
  onError?: (error: IntlError) => void
) {
  return yield* dictionaryTranslator("Toast", locale, onError);
});
