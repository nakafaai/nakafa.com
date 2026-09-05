import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";

const loadEnglishMessages = () =>
  import("@repo/internationalization/dictionaries/en.json", {
    with: { type: "json" },
  });
type MessagesModule = Awaited<ReturnType<typeof loadEnglishMessages>>;

const loadMessagesByLocale = {
  de: () =>
    import("@repo/internationalization/dictionaries/de.json", {
      with: { type: "json" },
    }),
  en: loadEnglishMessages,
  id: () =>
    import("@repo/internationalization/dictionaries/id.json", {
      with: { type: "json" },
    }),
} satisfies Record<AppLocaleCode, () => Promise<MessagesModule>>;

/**
 * Loads one reviewed dictionary at the framework Promise boundary.
 * https://nextjs.org/docs/messages/next-prerender-current-time
 */
export async function loadLocaleMessages(locale: AppLocaleCode) {
  const messages = await loadMessagesByLocale[locale]();
  return messages.default;
}
