import type { Locale } from "@repo/internationalization/src/locale";
import { Effect, Option, Schema } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { readProfileGate } from "@/lib/profile/gate";
import { notFoundPageOf, withContentLanguage } from "@/lib/routing/not-found";
import { readProjectedHtmlRouteRejection } from "@/lib/routing/public/projected";
import { readSourceBackedHtmlRouteRejection } from "@/lib/routing/public/source";
import {
  readBareRedirect,
  readMainSiteRedirect,
  readMigrationResponse,
  readMovedResponse,
  readRemovedAddressNotFound,
  readRootRedirectResponse,
  readSlashRedirectResponse,
  readSpellingRedirectResponse,
} from "@/lib/routing/redirect";
import { isBareRoutePath, isRenderedRoutePath } from "@/lib/routing/rendered";
import {
  answerRouted,
  type RouterHandler,
  UncaughtRequestError,
} from "@/lib/routing/routed.server";
import { readSchoolRefusal } from "@/lib/routing/school/refusal";
import { answerSchoolPage } from "@/lib/routing/school/shell.server";
import { answerUnmatchedRequest } from "@/lib/routing/unmatched.server";
import { readSchoolTreeGate } from "@/lib/tenant/gate";

/** Names a failure of a decision as the entry's uncaught error, and keeps an error that already is one. */
function toUncaughtRequestError(cause: unknown) {
  return Schema.is(UncaughtRequestError)(cause)
    ? cause
    : new UncaughtRequestError({ cause });
}

/**
 * Answers the app's own not-found page at the visitor's address, in the locale
 * that the address names. The router renders the address with the page in its
 * server context, so the root route answers not found and the browser hydrates
 * the same root match at the same address.
 */
const answerNotFound = Effect.fn("www.routing.answer.notFound")(function* (
  request: Request,
  locale: Locale,
  route: RouterHandler
) {
  const response = yield* answerRouted(
    request,
    route,
    Option.some(notFoundPageOf(request, locale))
  );
  return withContentLanguage(response, locale);
});

/**
 * Answers a rejection that names no page the Worker renders with the static
 * not-found page, and any other rejection with the app's own not-found page.
 */
const answerRejection = Effect.fn("www.routing.answer.rejection")(function* (
  request: Request,
  locale: Locale,
  route: RouterHandler
) {
  if (!isRenderedRoutePath(new URL(request.url))) {
    return yield* answerUnmatchedRequest(request);
  }
  return yield* answerNotFound(request, locale, route);
});

/**
 * Answers a request that no address decision answered: the not-found page of a
 * document that the projection does not own, then the root's locale redirect, then
 * the locale redirect of a bare page address, then the static shell of a school
 * page, or else the router's page. A path that no Worker route renders answers the
 * static not-found page before the router runs.
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
    return yield* answerRejection(request, rejected, route);
  }

  const root = readRootRedirectResponse(request);
  if (Option.isSome(root)) {
    return root.value;
  }
  if (isBareRoutePath(url)) {
    const bare = readBareRedirect(request);
    if (Option.isSome(bare)) {
      return bare.value;
    }
  }
  if (!isRenderedRoutePath(url)) {
    return yield* answerUnmatchedRequest(request);
  }
  return yield* answerSchoolPage(request, 200, answerRouted(request, route));
});

/**
 * Answers one request before the router runs. The address and the headers alone
 * decide each answer, in this order: a host under the production domain that
 * names no school moves to the main site; a non-canonical slash spelling moves to
 * its canonical address; a non-public spelling moves to its public address. A
 * school tree path, a refused school page and a removed address answer not found
 * (a refused school page with the static school shell),
 * and a migrated or moved address moves to its successor. A raw user address
 * answers not found, and a document that the source does not own answers not found
 * (ADR 0026). The root and a bare page address then move to the negotiated locale.
 * The router answers the rest only for a path that a Worker route renders: every
 * other path, a probe for a file included, answers the static not-found page. A
 * not-found answer of a Worker route is the app's own page, in the locale of the
 * address. Markdown is never negotiated: an agent reads a page's `.md` twin, which
 * the build writes beside its HTML.
 */
export const answerRequest = Effect.fn("www.routing.answer.request")(function* (
  request: Request,
  route: RouterHandler
) {
  const mainSite = readMainSiteRedirect(request);
  if (Option.isSome(mainSite)) {
    return mainSite.value;
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
    return yield* answerSchoolPage(
      request,
      404,
      answerNotFound(request, refused.value, route)
    );
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
    return yield* answerRejection(request, sourceRejection, route);
  }

  return yield* answerRouter(request, route).pipe(
    Effect.mapError(toUncaughtRequestError)
  );
});
