import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Effect, Schema } from "effect";
import type { Locale } from "use-intl";

/** Expected failure when a localized SEO dictionary cannot be loaded. */
export class SEOTranslationLoadError extends Schema.TaggedError<SEOTranslationLoadError>()(
  "SEOTranslationLoadError",
  {
    locale: Schema.String,
    message: Schema.String,
    namespace: Schema.String,
  }
) {}

/** Converts unknown thrown values into readable fallback error messages. */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown translation loading error";
}

/** Reads the translator of one dictionary namespace used by SEO metadata. */
export function fetchSEOTranslationsNamespace(
  locale: Locale,
  namespace: "Metadata" | "SEO" | "Subject"
) {
  return Effect.tryPromise({
    try: () => readServerTranslator({ locale, namespace }),
    catch: (error: unknown) =>
      new SEOTranslationLoadError({
        locale,
        namespace,
        message: `Failed to load ${namespace} translations: ${getErrorMessage(error)}`,
      }),
  });
}
