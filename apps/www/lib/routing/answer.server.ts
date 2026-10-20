import "@tanstack/react-start/server-only";

import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import type { Locale } from "@repo/internationalization/src/locale";
import { handleStartError } from "@tanstack/react-start/server";
import { Effect, Option, Schema } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { negotiateDocument } from "@/lib/llms/negotiate.server";
import { readOgAliasRequest } from "@/lib/og/alias";
import { readProfileGate } from "@/lib/profile/gate";
import {
  createNotFoundRequest,
  withContentLanguage,
} from "@/lib/routing/not-found";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";
import {
  readMainSiteRedirect,
  readMigrationResponse,
  readMovedResponse,
  readRedirectResponse,
  readRemovedAddressNotFound,
  readSlashRedirectResponse,
  readSpellingRedirectResponse,
} from "@/lib/routing/redirect";
import { readSchoolRefusal } from "@/lib/routing/school/refusal";
import { readSchoolTreeGate } from "@/lib/tenant/gate";

/** The router's answer to one request, which may fail with the error Start throws. */
export type RouterHandler = (request: Request) => Promise<Response>;

/** An error that escaped a decision of the server entry, kept with its original cause. */
export class UncaughtRequestError extends Schema.TaggedError<UncaughtRequestError>()(
  "UncaughtRequestError",
  { cause: Schema.Unknown }
) {}

/** Names a failure of a decision as the entry's uncaught error, and keeps an error that already is one. */
function toUncaughtRequestError(cause: unknown) {
  return Schema.is(UncaughtRequestError)(cause)
    ? cause
    : new UncaughtRequestError({ cause });
}

/**
 * Routes one request to the router. A failure that escapes the router is
 * reported here and answered with Start's error response, so the router's answer
 * handles its own failures before the negotiation sees them.
 */
const answerRouted = Effect.fn("www.routing.answer.routed")(function* (
  request: Request,
  route: RouterHandler
) {
  return yield* Effect.tryPromise({
    try: () => route(request),
    catch: (cause) => new UncaughtRequestError({ cause }),
  }).pipe(
    Effect.catchTag("UncaughtRequestError", (error) =>
      reportUncaughtRequestError(error.cause, request).pipe(
        Effect.as(handleStartError(error.cause))
      )
    )
  );
});

/** Answers the app's own not-found page, in the locale that the address names. */
const answerNotFound = Effect.fn("www.routing.answer.notFound")(function* (
  request: Request,
  locale: Locale,
  route: RouterHandler
) {
  const response = yield* answerRouted(
    createNotFoundRequest(request, locale),
    route
  );
  return withContentLanguage(response, locale);
});

/**
 * Answers a request that no address decision answered, after the negotiation:
 * the not-found page of a document that the projection does not own, then the
 * locale redirect when the request has one, or else the router's page.
 */
const answerRouter = Effect.fn("www.routing.answer.router")(function* (
  request: Request,
  route: RouterHandler
) {
  const url = new URL(request.url);
  const rejected = yield* readProjectedHtmlRouteRejection({
    hasAttemptCapability: hasTryoutAttemptCapability(url.searchParams),
    pathname: url.pathname,
  }).pipe(Effect.mapError(toUncaughtRequestError));
  if (rejected !== null) {
    return yield* answerNotFound(request, rejected, route);
  }

  const redirect = readRedirectResponse(request);
  if (Option.isSome(redirect)) {
    return redirect.value;
  }
  return yield* answerRouted(request, route);
});

/**
 * Answers one request before the router runs. The address and the headers alone
 * decide each answer, in this order: a host under the production domain that
 * names no school moves to the main site, a social image alias reaches the OG
 * route, a non-canonical slash spelling moves to its canonical address, and a
 * non-public spelling moves to its public address. A school tree path, a refused
 * school page and a removed address answer not found, and a migrated or moved
 * address moves to its successor. A raw user address answers not found, and a
 * document that the source does not own answers not found (ADR 0026). The
 * negotiation then answers Markdown or 406, and the router answers the rest after
 * the locale redirects. Each not-found answer is the app's own page, in the
 * locale of the address.
 */
export const answerRequest = Effect.fn("www.routing.answer.request")(function* (
  request: Request,
  route: RouterHandler
) {
  const mainSite = readMainSiteRedirect(request);
  if (Option.isSome(mainSite)) {
    return mainSite.value;
  }

  const image = readOgAliasRequest(request);
  if (Option.isSome(image)) {
    return yield* answerRouted(image.value, route);
  }

  const slash = readSlashRedirectResponse(request);
  if (Option.isSome(slash)) {
    return slash.value;
  }

  const spelling = readSpellingRedirectResponse(request);
  if (Option.isSome(spelling)) {
    return spelling.value;
  }

  const schoolTree = readSchoolTreeGate(request);
  if (Option.isSome(schoolTree)) {
    return yield* answerNotFound(request, schoolTree.value, route);
  }

  const refused = yield* readSchoolRefusal(request);
  if (Option.isSome(refused)) {
    return yield* answerNotFound(request, refused.value, route);
  }

  const removed = yield* readRemovedAddressNotFound(request).pipe(
    Effect.mapError(toUncaughtRequestError)
  );
  if (Option.isSome(removed)) {
    return yield* answerNotFound(request, removed.value, route);
  }

  const migrated = yield* readMigrationResponse(request).pipe(
    Effect.mapError(toUncaughtRequestError)
  );
  if (Option.isSome(migrated)) {
    return migrated.value;
  }

  const moved = readMovedResponse(request);
  if (Option.isSome(moved)) {
    return moved.value;
  }

  const profileGate = readProfileGate(request);
  if (Option.isSome(profileGate)) {
    return yield* answerNotFound(request, profileGate.value, route);
  }

  const sourceRejection = yield* readSourceBackedHtmlRouteRejection({
    method: request.method,
    pathname: new URL(request.url).pathname,
  }).pipe(Effect.mapError(toUncaughtRequestError));
  if (sourceRejection !== null) {
    return yield* answerNotFound(request, sourceRejection, route);
  }

  return yield* negotiateDocument(request, answerRouter(request, route)).pipe(
    Effect.mapError(toUncaughtRequestError)
  );
});
