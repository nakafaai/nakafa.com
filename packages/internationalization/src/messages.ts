import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";

const loadEnglishMessages = () =>
  Promise.all([
    import("@repo/internationalization/dictionaries/en.json", {
      with: { type: "json" },
    }),
    import("@repo/internationalization/dictionaries/standalone/en.json", {
      with: { type: "json" },
    }),
  ]);
type MessagesModules = Awaited<ReturnType<typeof loadEnglishMessages>>;

/**
 * Each locale has its dictionary, and beside it the small dictionary of the
 * pages that stand without the app (`dictionaries/standalone`). Those pages
 * read their own file, so they never carry the whole dictionary; the app reads
 * both as one set of messages.
 */
const loadMessagesByLocale = {
  de: () =>
    Promise.all([
      import("@repo/internationalization/dictionaries/de.json", {
        with: { type: "json" },
      }),
      import("@repo/internationalization/dictionaries/standalone/de.json", {
        with: { type: "json" },
      }),
    ]),
  en: loadEnglishMessages,
  id: () =>
    Promise.all([
      import("@repo/internationalization/dictionaries/id.json", {
        with: { type: "json" },
      }),
      import("@repo/internationalization/dictionaries/standalone/id.json", {
        with: { type: "json" },
      }),
    ]),
} satisfies Record<AppLocaleCode, () => Promise<MessagesModules>>;

/**
 * Loads one reviewed dictionary, with the words of the standalone pages in it,
 * at the framework Promise boundary.
 * https://nextjs.org/docs/messages/next-prerender-current-time
 */
export async function loadLocaleMessages(locale: AppLocaleCode) {
  const [messages, standalone] = await loadMessagesByLocale[locale]();
  return { ...messages.default, ...standalone.default };
}
