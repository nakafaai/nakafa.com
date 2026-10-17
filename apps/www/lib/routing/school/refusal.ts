import { HttpClient } from "@confect/js";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option } from "effect";
import type { NextRequest } from "next/server";
import { clientEnv } from "@/env.client";
import { readSessionToken } from "@/lib/auth/token";
import { httpLayer } from "@/lib/convex/http";
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
 * A visitor with no session reads the school's profile. The profile names the
 * school to anyone, so only a school that does not exist refuses the page.
 */
const readVisitorRefusal = Effect.fn("www.routing.school.visitorRefusal")(
  function* (slug: TenantSlug) {
    return yield* HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.profile.get, { slug })),
      Effect.as(false),
      Effect.catchTag("TenantNotFound", () => Effect.succeed(true)),
      Effect.provide(httpLayer())
    );
  }
);

/**
 * A signed-in visitor reads the school as a member. `NotMember` answers a school
 * that does not exist and a school the visitor does not belong to alike, so the
 * answer never tells the two apart. `AccessDenied` refuses the page as the layout
 * does. An account or a session that the app cannot read leaves the page to the
 * layout, as it does today.
 */
const readMemberRefusal = Effect.fn("www.routing.school.memberRefusal")(
  function* (slug: TenantSlug, token: string) {
    return yield* HttpClient.HttpClient.pipe(
      Effect.flatMap((client) => client.query(tenancy.viewer.get, { slug })),
      Effect.as(false),
      Effect.catchTags({
        AccessDenied: () => Effect.succeed(true),
        AccountUnavailable: () => Effect.succeed(false),
        NotMember: () => Effect.succeed(true),
        SessionRequired: () => Effect.succeed(false),
      }),
      Effect.provide(httpLayer({ auth: token }))
    );
  }
);

/**
 * Reads whether one school refuses a page for these headers: its profile for a
 * visitor with no session, and its viewer for a signed-in one.
 */
const readRefusal = Effect.fn("www.routing.school.refusal")(function* (
  slug: TenantSlug,
  headers: Headers
) {
  const token = yield* readSessionToken(
    clientEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
    headers
  );
  if (token === undefined) {
    return yield* readVisitorRefusal(slug);
  }
  return yield* readMemberRefusal(slug, token);
});

/**
 * Decides, before a school page streams, whether the school tree answers the
 * request with not found (ADR 0026). The answer is the locale of the not-found
 * page, which next-intl chooses as it does for the school page, or none when the
 * request goes on to the school tree.
 *
 * Only a page request pays the read. A client navigation or a prefetch keeps the
 * school of its host, and the layout still refuses a membership that has ended. A
 * failed read goes on to the school tree, and the full cause is logged, so an
 * outage never answers a page with not found.
 */
export const readSchoolRefusal = Effect.fn("www.routing.school.pageRefusal")(
  function* (request: NextRequest) {
    const school = readServedSchool(request);
    if (Option.isNone(school) || !isPageRequest(request)) {
      return Option.none();
    }
    const refused = yield* readRefusal(school.value, request.headers).pipe(
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
