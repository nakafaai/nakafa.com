/** Supported locales shared by routing, content schemas, and backend validators. */
export const locales = ["en", "id"] as const;
export type Locale = (typeof locales)[number];

/** Locale used when a request does not provide a supported locale. */
export const defaultLocale = "en";

/** Builds one required field map from the canonical locale source. */
export function fieldsForEveryLocale<Value>(
  value: Value
): Record<Locale, Value> {
  return {
    en: value,
    id: value,
  };
}
