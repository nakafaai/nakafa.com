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
import type { Locale } from "@repo/internationalization/src/locale";

/**
 * The small dictionary of the pages that stand without the app. An error or
 * not-found boundary reads it, so it never loads the whole dictionary.
 */
const STANDALONE_MESSAGES = { de, en, id, ms } satisfies Record<
  AppLocaleCode,
  unknown
>;

/** The words of the standalone pages in one locale. */
export function readStandaloneMessages(locale: Locale) {
  return STANDALONE_MESSAGES[locale];
}
