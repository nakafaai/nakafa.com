import { getRouteMessages } from "@repo/internationalization/src/messages";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { Array as Arr, DateTime, Effect, Schema } from "effect";

/**
 * The message namespaces that the school pages render: the school's own words, the
 * exam and classroom words of its pages, the sign-in and not-found words of its
 * entry and error states, and the shared words of the shell. The browser picks only
 * these from its locale's dictionary.
 */
const SCHOOL_NAMESPACES = [
  "AnalyticsConsent",
  "Auth",
  "Classroom",
  "Common",
  "DataTable",
  "Editor",
  "Error",
  "Exams",
  "Legal",
  "Metadata",
  "NotFound",
  "Notifications",
  "Player",
  "School",
  "SchoolEntry",
  "SchoolGrades",
  "SchoolGuardians",
  "SchoolReports",
  "SchoolRoster",
  "SchoolSettings",
  "SchoolStart",
  "State",
  "Toast",
  "Tryouts",
  "Utils",
] as const;

/** The browser could not load the dictionary of the school's locale. */
export class SchoolMessagesUnavailable extends Schema.TaggedError<SchoolMessagesUnavailable>()(
  "SchoolMessagesUnavailable",
  { cause: Schema.Unknown }
) {}

/**
 * The locale that a school page renders in. A school address names no locale, so
 * the browser negotiates it as a request would: the language cookie that the
 * account menu writes, then the browser's preferred languages.
 */
export function readSchoolLocale() {
  return negotiateLocale(
    new Headers({
      "accept-language": Arr.join(navigator.languages, ","),
      cookie: document.cookie,
    })
  );
}

/**
 * The locale, the messages and the instant of every school page, read in the
 * browser. Only the dictionary of the negotiated locale is downloaded.
 */
export const readSchoolRoot = Effect.fn("www.tenant.root")(function* () {
  const locale = yield* Effect.sync(readSchoolLocale);
  const messages = yield* Effect.tryPromise({
    catch: (cause) => new SchoolMessagesUnavailable({ cause }),
    try: () => getRouteMessages(locale, SCHOOL_NAMESPACES),
  });
  const now = yield* DateTime.now;
  return { locale, messages, now: DateTime.toDateUtc(now) };
});
