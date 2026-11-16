import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import de from "@repo/internationalization/dictionaries/standalone/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/standalone/id.json" with {
  type: "json",
};
import ms from "@repo/internationalization/dictionaries/standalone/ms.json" with {
  type: "json",
};
import type { MessageNamespace } from "@repo/internationalization/src/namespace";
import { Struct } from "effect";

const loadEnglish = () =>
  import("@repo/internationalization/dictionaries/en.json", {
    with: { type: "json" },
  });

/** The module of the app dictionary that every locale writes in full, with English's keys. */
type DictionaryModule = Awaited<ReturnType<typeof loadEnglish>>;

/** The app dictionary itself. */
type Dictionary = DictionaryModule["default"];

/**
 * The app dictionary of each locale, loaded at its first read, so a page
 * downloads only its own language. Every locale writes every word that English
 * has, so a missing word is a build error.
 */
const DICTIONARIES = {
  de: () =>
    import("@repo/internationalization/dictionaries/de.json", {
      with: { type: "json" },
    }),
  en: loadEnglish,
  id: () =>
    import("@repo/internationalization/dictionaries/id.json", {
      with: { type: "json" },
    }),
  ms: () =>
    import("@repo/internationalization/dictionaries/ms.json", {
      with: { type: "json" },
    }),
} satisfies Record<AppLocaleCode, () => Promise<DictionaryModule>>;

/** `true` only when the two types are identical, so a difference is a compile error. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** The namespace list names exactly the namespaces that the dictionaries define, in both directions. */
type NamespacesMatchDictionaries =
  Equals<MessageNamespace, keyof Dictionary | keyof typeof en> extends true
    ? unknown
    : never;

/**
 * The small dictionary of the pages that stand without the app: the error and
 * not-found boundaries and the document's head. They read it at once, so it
 * never waits for the whole dictionary. A namespace that the list and the
 * dictionaries do not both name is a build error.
 */
const STANDALONE = { de, en, id, ms } satisfies Record<
  AppLocaleCode,
  typeof en
> &
  NamespacesMatchDictionaries;

/** The words of the standalone pages in one locale. */
export function readStandaloneMessages(locale: AppLocaleCode): typeof en {
  return STANDALONE[locale];
}

/**
 * Loads one locale's messages: its app dictionary with the words of the
 * standalone pages, at the framework Promise boundary, since a dictionary is a
 * module that loads on demand.
 */
export async function loadLocaleMessages(locale: AppLocaleCode) {
  const dictionary: DictionaryModule = await DICTIONARIES[locale]();
  const standalone: typeof en = STANDALONE[locale];
  return { ...dictionary.default, ...standalone };
}

/**
 * The messages of one route: only the namespaces that the route renders, so the
 * first HTML of the route carries those words and no others. The server picks
 * them for a rendered route, and the browser for a move between pages.
 */
export async function getRouteMessages<
  const Namespaces extends readonly MessageNamespace[],
>(locale: AppLocaleCode, namespaces: Namespaces) {
  const messages = await loadLocaleMessages(locale);
  return Struct.pick<typeof messages, Namespaces>(namespaces)(messages);
}
