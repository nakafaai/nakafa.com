import { HttpClient } from "@confect/js";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { isSharedPath } from "@repo/internationalization/src/rewrite";
import { Data, Duration, Effect, Option, Schema } from "effect";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { readStoreEntry, writeStoreEntry } from "@/lib/content/store/entry";
import { httpSingleAttemptLayer } from "@/lib/convex/http";
import { readSchoolSlug } from "@/lib/routing/school/host";

/**
 * The gate did not answer within NETWORK_ATTEMPT_DEADLINE, the bound that every
 * attempt of a network read takes. The page goes on without the answer, as it
 * does for every failed read.
 */
class SchoolReadDeadline extends Data.TaggedError("SchoolReadDeadline") {}

/** Store tag of every kept answer, which a test expires between visits. */
export const SCHOOL_REFUSAL_TAG = "school-refusal";
/**
 * How long an isolate keeps a school's answer. Scanners try hundreds of addresses
 * on invented hosts, and each one would otherwise reach Convex, so a minute bounds
 * the reads to one a minute per host and isolate. A visitor of a school opened
 * within that minute can see not found once; a member's session never asks.
 */
const SCHOOL_REFUSAL_LIFETIME = Duration.seconds(60);

/**
 * Reads whether the school refuses a visitor, in one query with no session: the
 * backend decides the school's existence (`tenancy.profile.refusal`).
 */
const readRefusal = Effect.fn("www.routing.school.refusal")(function* (
  slug: TenantSlug
) {
  const parts = ["school-refusal", slug];
  const stored = yield* readStoreEntry({ parts, schema: Schema.Boolean });
  if (Option.isSome(stored)) {
    return stored.value;
  }
  const refused = yield* HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(tenancy.profile.refusal, { slug })),
    Effect.provide(httpSingleAttemptLayer())
  );
  yield* writeStoreEntry({
    parts,
    schema: Schema.Boolean,
    tags: [SCHOOL_REFUSAL_TAG],
    ttl: SCHOOL_REFUSAL_LIFETIME,
    value: refused,
  });
  return refused;
});

/**
 * Decides, before a school page streams, whether the school refuses a visitor
 * (ADR 0026). The answer is the locale of the not-found page, negotiated from the
 * request, or none when the school tree answers. A request whose host names no
 * school has none, and so has a method that is not a document read: only a GET or
 * HEAD request is a page. A request with a session reads nothing here: the
 * page's own gate reads the viewer in the browser and draws the refusal, so a
 * signed-in page gets the school shell at once instead of after two reads.
 *
 * The whole gate waits at most NETWORK_ATTEMPT_DEADLINE, so a school that does not
 * answer holds the page for that long at most (ADR 0026). A failed or late read
 * goes on to the school tree, and the full cause is logged, so an outage never
 * answers a page with not found.
 */
export const readSchoolRefusal = Effect.fn("www.routing.school.pageRefusal")(
  function* (request: Request) {
    const url = new URL(request.url);
    const slug = readSchoolSlug(url.hostname);
    if (
      Option.isNone(slug) ||
      isSharedPath(url.pathname) ||
      (request.method !== "GET" && request.method !== "HEAD") ||
      readSessionCookie(request) !== null
    ) {
      return Option.none();
    }
    const refused = yield* readRefusal(slug.value).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () => Effect.fail(new SchoolReadDeadline()),
      }),
      Effect.catchCause((cause) =>
        Effect.logError(
          "A school address could not be read, so its page goes on to the school tree.",
          cause
        ).pipe(Effect.as(false))
      )
    );
    return refused
      ? Option.some(negotiateLocale(request.headers))
      : Option.none();
  }
);
