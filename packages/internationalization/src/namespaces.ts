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
import { Record as Rec, Schema, Struct } from "effect";

/**
 * Every namespace of the app dictionaries, and the standalone pages' namespaces
 * beside them. The record is checked against the English dictionary, so a
 * namespace that one dictionary adds or drops fails the build here.
 */
const namespaceFlags = {
  AnalyticsConsent: true,
  Articles: true,
  Auth: true,
  Classroom: true,
  Common: true,
  ComingSoon: true,
  Comments: true,
  Contributor: true,
  DataTable: true,
  Editor: true,
  Exams: true,
  Faq: true,
  Holy: true,
  Home: true,
  Landing: true,
  LearningPrograms: true,
  Legal: true,
  Marketing: true,
  Memory: true,
  Metadata: true,
  Notifications: true,
  Player: true,
  Posts: true,
  Pricing: true,
  PricingPage: true,
  Ai: true,
  About: true,
  Subject: true,
  School: true,
  SchoolEntry: true,
  SchoolSettings: true,
  SchoolStart: true,
  SEO: true,
  Toast: true,
  Tryouts: true,
  Utils: true,
  Videos: true,
  Weather: true,
  NotFound: true,
  Error: true,
  State: true,
} satisfies Record<keyof typeof en | keyof typeof enStandalone, true>;

/** The namespaces that the dictionaries define, as literal names. */
export const MESSAGE_NAMESPACES = Rec.keys(namespaceFlags);

/** One message namespace, decoded from a route's declaration. */
export const MessageNamespaceSchema = Schema.Literals(MESSAGE_NAMESPACES);

type MessageNamespace = typeof MessageNamespaceSchema.Type;

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
