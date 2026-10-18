import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { schoolRouting } from "@repo/internationalization/src/routing";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Array as Arr, Option } from "effect";
import { NextRequest, NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { rewriteToNotFoundPage } from "@/lib/routing/answer";
import { isLocaleBypassPath } from "@/lib/routing/bypass";
import { readMissingLocale } from "@/lib/routing/missing";
import {
  isRefusedSchoolHost,
  readRequestHostname,
  readSchoolSlug,
} from "@/lib/routing/school/host";
import { isSchoolTreePath, SCHOOL_SEGMENT } from "@/lib/routing/school/tree";

const handleSchoolLocalizedRequest = createMiddleware(schoolRouting);

/**
 * The request headers that choose a school's language and answer: the
 * `NEXT_LOCALE` cookie and Accept-Language. Caches keep one answer per visitor
 * kind for them, on the school page and on its not-found page alike.
 */
export const SCHOOL_VISITOR_VARY_FIELDS = ["Accept-Language", "Cookie"];

/** Sets Vary for the request headers that choose a school's language and answer. */
function varyBySchoolVisitor(response: NextResponse) {
  response.headers.set(
    "Vary",
    mergeVaryHeader(
      Option.fromNullOr(response.headers.get("Vary")),
      SCHOOL_VISITOR_VARY_FIELDS
    )
  );
}

/**
 * Rewrites a school host's path into the school tree. next-intl picks the
 * locale from the `NEXT_LOCALE` cookie, then `Accept-Language`, then the default,
 * and puts it in front of the rewritten path, so the page renders in that
 * language. The address keeps the host and the path, and school pages are not
 * indexed. The rewrite names the request URL and not `nextUrl`, which maps a
 * loopback address to `localhost`, so a server bound to 127.0.0.1 would have Next
 * proxy the rewrite (see `readVisitorUrl`).
 */
function rewriteToSchool(request: NextRequest, slug: TenantSlug) {
  const { pathname } = request.nextUrl;
  const schoolUrl = new URL(request.url);
  schoolUrl.pathname = `/${SCHOOL_SEGMENT}/${slug}${pathname === "/" ? "" : pathname}`;

  const response = handleSchoolLocalizedRequest(
    new NextRequest(schoolUrl, { headers: request.headers })
  );
  response.headers.set("X-Robots-Tag", "noindex");
  varyBySchoolVisitor(response);
  return response;
}

/** Whether a path segment is a locale that the school routing serves. */
function isSchoolLocale(
  segment: string
): segment is (typeof schoolRouting.locales)[number] {
  return hasLocale(schoolRouting.locales, segment);
}

/** The first segment of a rewritten path when it is a locale that the school routing serves. */
function readPathLocale(pathname: string) {
  const [segment] = Arr.filter(pathname.split("/"), Boolean);
  return Option.fromUndefinedOr(segment).pipe(Option.filter(isSchoolLocale));
}

/**
 * The locale that the school page of a request gets, which next-intl chooses for
 * the school rewrite: the `NEXT_LOCALE` cookie, then Accept-Language, then the
 * default. It is read from the path that next-intl rewrites the request to. None
 * means that next-intl did not rewrite the request, which it does not do for a
 * path that it cannot decode. Such a path reaches the school tree for every
 * visitor alike, so its answer does not depend on whether the school refuses the
 * visitor (ADR 0026).
 */
export function readSchoolLocale(request: NextRequest, slug: TenantSlug) {
  const rewrite = rewriteToSchool(request, slug);
  return Option.fromNullOr(rewrite.headers.get("x-middleware-rewrite")).pipe(
    Option.map((destination) => new URL(destination, request.url).pathname),
    Option.flatMap(readPathLocale)
  );
}

/**
 * Sends a host under the production domain that names no school to the main
 * site, with the same path and query, as a 307. The target starts from the
 * production origin and not from the request URL, because a local server builds
 * the request URL from its own address. Only the path and query are set, so a
 * path that starts with two slashes still stays on the main site.
 */
function redirectToMainSite(request: NextRequest) {
  const redirectUrl = new URL(SITE_ORIGIN);
  redirectUrl.pathname = request.nextUrl.pathname;
  redirectUrl.search = request.nextUrl.search;

  return NextResponse.redirect(redirectUrl, 307);
}

/**
 * The school address that a request reaches the school tree with: the school of
 * its host, unless the request is a bypass file that the public routes answer with
 * the file of the main site.
 */
export function readServedSchool(request: NextRequest) {
  if (isLocaleBypassPath(request.nextUrl.pathname)) {
    return Option.none();
  }
  return Option.flatMap(readRequestHostname(request.headers), readSchoolSlug);
}

/**
 * Answers a request that belongs to the school hosts before the public routes
 * see it, or returns nothing so that the public routes answer it. A school host
 * gets its school tree, a label that names no school under the production
 * domain goes to the main site, and the school tree answers the not-found page
 * (404) everywhere else.
 * The host is the one in the `host` header (see `readRequestHostname`). The root
 * files of the matcher never reach this function, so they are the same on every
 * host.
 */
export function routeSchoolRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = readRequestHostname(request.headers);
  const schoolSlug = readServedSchool(request);
  if (Option.isSome(schoolSlug)) {
    return rewriteToSchool(request, schoolSlug.value);
  }
  if (Option.exists(hostname, isRefusedSchoolHost)) {
    return redirectToMainSite(request);
  }
  if (isSchoolTreePath(pathname)) {
    return rewriteToNotFoundPage(
      request,
      readMissingLocale(request),
      SCHOOL_VISITOR_VARY_FIELDS,
      404
    );
  }
  return null;
}
