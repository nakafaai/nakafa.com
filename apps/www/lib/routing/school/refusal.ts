import { HttpClient } from "@confect/js";
import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Data, Effect, Option } from "effect";
import type { NextRequest } from "next/server";
import { clientEnv } from "@/env.client";
import { readSessionToken } from "@/lib/auth/token";
import { httpSingleAttemptLayer } from "@/lib/convex/http";
import { rewriteToNotFoundPage } from "@/lib/routing/answer";
import {
  readSchoolLocale,
  readServedSchool,
  routeSchoolRequest,
  SCHOOL_VISITOR_VARY_FIELDS,
} from "@/lib/routing/school/request";

/** The header that Next sends on every Flight request. */
const FLIGHT_HEADER = "rsc";

/**
 * The gate did not answer within NETWORK_ATTEMPT_DEADLINE, the bound that every
 * attempt of a network read takes. The page goes on without the answer, as it
 * does for every failed read.
 */
class SchoolReadDeadline extends Data.TaggedError("SchoolReadDeadline") {}

/**
 * Whether the request is the document of a page that a visitor opens. Next sends
 * `rsc: 1` on a client navigation and on a prefetch alike (the installed
 * `next/dist/client/components/router-reducer/fetch-server-response.js` and
 * `next/dist/client/components/segment-cache/cache.js`), so only a document lacks
 * it. A server action is a POST, and it is no page either.
 */
function isPageRequest(request: NextRequest) {
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get(FLIGHT_HEADER) !== "1"
  );
}

/**
 * Reads whether the school refuses a page for the caller, in one query: the backend
 * decides the school's existence and the caller's view of it together
 * (`tenancy.profile.refusal`). A visitor's query carries no session, and a signed-in
 * caller's carries its token, so the backend reads the same identity the layout reads.
 */
const readRefusal = Effect.fn("www.routing.school.refusal")(function* (
  slug: TenantSlug,
  headers: Headers
) {
  const token = yield* readSessionToken(
    clientEnv.VITE_CONVEX_SITE_URL,
    headers
  );
  return yield* HttpClient.HttpClient.pipe(
    Effect.flatMap((client) => client.query(tenancy.profile.refusal, { slug })),
    Effect.provide(
      httpSingleAttemptLayer(token === undefined ? undefined : { auth: token })
    )
  );
});

/**
 * Decides, before a school page streams, whether the school tree answers the
 * request with not found (ADR 0026). The answer is the locale of the not-found
 * page, which next-intl chooses as it does for the school page, or none when the
 * request goes on to the school tree.
 *
 * Only a page request pays the read. A client navigation or a prefetch keeps the
 * school of its host, and the layout still refuses a membership that has ended.
 * Each query makes one attempt, and the whole gate waits at most
 * NETWORK_ATTEMPT_DEADLINE, so a school that does not answer holds the page for
 * that long at most (ADR 0026). A failed or late read goes on to the school tree,
 * and the full cause is logged, so an outage never answers a page with not found.
 */
export const readSchoolRefusal = Effect.fn("www.routing.school.pageRefusal")(
  function* (request: NextRequest) {
    const school = readServedSchool(request);
    if (Option.isNone(school) || !isPageRequest(request)) {
      return Option.none();
    }
    const refused = yield* readRefusal(school.value, request.headers).pipe(
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
    return refused ? readSchoolLocale(request, school.value) : Option.none();
  }
);

/**
 * Answers a request of a school host before the public routes see it. A school
 * page that the school refuses gets the not-found page, and every other request
 * of a school host gets its school tree. Returns nothing for a request that the
 * public routes answer.
 */
export const routeSchoolPage = Effect.fn("www.routing.school.page")(function* (
  request: NextRequest
) {
  const refusal = yield* readSchoolRefusal(request);
  if (Option.isSome(refusal)) {
    return rewriteToNotFoundPage(
      request,
      refusal.value,
      SCHOOL_VISITOR_VARY_FIELDS
    );
  }
  return routeSchoolRequest(request);
});
