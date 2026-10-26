import { pickRouteMessages } from "@repo/internationalization/src/namespaces";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import {
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { DateTime, Effect } from "effect";
import { serverHandler } from "@/lib/server/fn";

/**
 * The message namespaces that the school pages render: the school's own words, the
 * exam and classroom words of its pages, the sign-in and not-found words of its
 * entry and error states, and the shared words of the shell. Only these leave the
 * server, so a school page never carries the whole dictionary.
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
  "SchoolGuardians",
  "SchoolSettings",
  "SchoolStart",
  "State",
  "Toast",
  "Tryouts",
  "Utils",
] as const;

/**
 * The locale, the messages and the request instant of every school page. A school
 * address names no locale, so the server negotiates it from the request, the same
 * way the school frame does. The answer is private, because it depends on the
 * visitor's language.
 */
export const schoolRootHandler = serverHandler(() =>
  Effect.gen(function* () {
    yield* Effect.sync(() =>
      setResponseHeader("cache-control", "private, no-store")
    );
    const locale = negotiateLocale(getRequestHeaders());
    const now = yield* DateTime.now;
    return {
      locale,
      messages: pickRouteMessages(locale, SCHOOL_NAMESPACES),
      now: DateTime.toDateUtc(now),
    };
  })
);
