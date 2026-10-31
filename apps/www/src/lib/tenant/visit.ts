import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { Locale } from "@repo/internationalization/src/locale";
import { Duration, Effect, Option, Schedule } from "effect";
import { readTokenClaims } from "@/lib/auth/claims";
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
 * beside the school's own reads, and only a visitor keeps its answer. When the
 * sign-in hint says the browser is signed out, a visitor's reads start beside the
 * token's, and a token that answers anyway decides as a signed-in read. The answer
 * names the session the token belongs to, which a kept frame is kept for.
 */
export const readBrowserVisit = Effect.fn("www.tenant.readBrowserVisit")(
  function* (input: {
    readonly legal: Effect.Effect<AuthLegalLinks | null, SchoolReadFailed>;
    readonly locale: Locale;
    readonly signedIn: boolean;
    readonly slug: TenantSlug;
  }) {
    const { legal, locale, signedIn, slug } = input;
    const visitor = Effect.suspend(() =>
      Effect.all(
        [readSchoolFrame({ locale, slug, token: Option.none() }), legal],
        { concurrency: "unbounded" }
      )
    ).pipe(
      Effect.map(([school, links]) => ({
        legal: school._tag === "Visitor" ? links : null,
        school,
        sessionId: null,
      }))
    );
    const origin = yield* Effect.sync(() => window.location.origin);
    const token = readBrowserSessionToken(origin).pipe(
      Effect.mapError((cause) => new SchoolReadFailed({ cause }))
    );
    // The early visitor's answer is kept as a value, so it fails the decision only when the decision uses it.
    const [held, early] = yield* Effect.all(
      [
        token,
        signedIn ? Effect.succeedNone : Effect.asSome(Effect.result(visitor)),
      ],
      { concurrency: "unbounded" }
    );
    if (held === undefined) {
      return yield* Option.match(early, {
        onNone: () => visitor,
        onSome: Effect.fromResult,
      });
    }
    const school = yield* readSchoolFrame({
      locale,
      slug,
      token: Option.some(held),
    });
    return {
      legal: null,
      school,
      sessionId: Option.getOrNull(
        Option.map(readTokenClaims(held), (claims) => claims.sessionId)
      ),
    };
  }
);

/** The wait before a failed school read tries again, which doubles with each try. */
const READ_RETRY_WAIT = Duration.millis(400);

/** How many more times a failed school read tries. */
const READ_RETRIES = 2;

/**
 * Tries a school's first read again on a failure. A phone on a weak network loses a request now and
 * then, and one lost request must not stand for a broken school: the page shows its failure only
 * once the network has failed the read each time.
 */
export const retryVisitRead = <A, R>(
  read: Effect.Effect<A, SchoolReadFailed, R>
) =>
  read.pipe(
    Effect.retry({
      schedule: Schedule.exponential(READ_RETRY_WAIT),
      times: READ_RETRIES,
    })
  );
