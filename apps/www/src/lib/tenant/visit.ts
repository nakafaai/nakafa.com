import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { Locale } from "@repo/internationalization/src/locale";
import { Effect, Option } from "effect";
import type { AuthLegalLinks } from "@/lib/auth/legal";
import { readBrowserSessionToken } from "@/lib/auth/token";
import { readSchoolFrame, SchoolReadFailed } from "@/lib/tenant/read";

/** What the router says caused a school navigation: a visit that enters the school, a preload, or a stay in it. */
type NavigationCause = "enter" | "preload" | "stay";

/**
 * Whether a navigation into a school reuses the frame that its visit already read. A visit that enters
 * the school reads the frame, and so does a match that a refresh invalidated, because the refresh asks
 * for the membership again. Every other navigation reuses the frame.
 */
export function reusesVisitFrame(navigation: {
  readonly cause: NavigationCause;
  readonly invalid: boolean;
}): boolean {
  return navigation.cause !== "enter" && !navigation.invalid;
}

/**
 * Decides a school page in the browser, where every school page renders (ADR 0038
 * D2): the session's Convex token from the token route of the school's own host,
 * then the same decision as `readSchoolFrame`. A failed token read fails the
 * decision, so an outage never looks like a signed-out visitor. A visitor's entry
 * page names the privacy and terms pages, so a read with no session takes `legal`
 * beside the school's own reads, and only a visitor keeps its answer.
 */
export const readBrowserVisit = Effect.fn("www.tenant.readBrowserVisit")(
  function* (
    slug: TenantSlug,
    locale: Locale,
    legal: Effect.Effect<AuthLegalLinks | null, SchoolReadFailed>
  ) {
    const origin = yield* Effect.sync(() => window.location.origin);
    const token = yield* readBrowserSessionToken(origin).pipe(
      Effect.mapError((cause) => new SchoolReadFailed({ cause }))
    );
    if (token !== undefined) {
      const school = yield* readSchoolFrame({
        locale,
        slug,
        token: Option.some(token),
      });
      return { legal: null, school };
    }
    const [school, links] = yield* Effect.all(
      [readSchoolFrame({ locale, slug, token: Option.none() }), legal],
      { concurrency: "unbounded" }
    );
    return { legal: school._tag === "Visitor" ? links : null, school };
  }
);
