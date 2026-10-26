import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";

/** Reads the try-out and pricing translators of a locale, which the locked review reads while its preview loads. */
export function readReviewTranslators(locale: Locale) {
  return Promise.all([
    readServerTranslator({ locale, namespace: "Tryouts" }),
    readServerTranslator({ locale, namespace: "Pricing" }),
  ]);
}
