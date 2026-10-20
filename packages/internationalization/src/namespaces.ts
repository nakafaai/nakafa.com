import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import deStandalone from "@repo/internationalization/dictionaries/standalone/de.json" with {
  type: "json",
};
import enStandalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import idStandalone from "@repo/internationalization/dictionaries/standalone/id.json" with {
  type: "json",
};
import type { Locale } from "@repo/internationalization/src/locale";
import type { MessageNamespace } from "@repo/internationalization/src/namespace";
import { Struct } from "effect";

/**
 * The complete messages of each locale: the app dictionary with the words of
 * the standalone pages. Every locale must define every namespace, which the
 * `satisfies` check makes a build error when one does not.
 */
const MESSAGES = {
  de: { ...de, ...deStandalone },
  en: { ...en, ...enStandalone },
  id: { ...id, ...idStandalone },
} satisfies Record<Locale, Record<MessageNamespace, unknown>>;

/** The messages of every locale, which share one shape. */
type Messages = (typeof MESSAGES)["en"];

/**
 * The messages that one route renders in one locale. The server reads the
 * dictionary, and only these namespaces leave it, so the browser never receives
 * the rest.
 */
export function pickRouteMessages<
  const Namespaces extends readonly MessageNamespace[],
>(locale: Locale, namespaces: Namespaces) {
  return Struct.pick<Messages, Namespaces>(namespaces)(MESSAGES[locale]);
}
