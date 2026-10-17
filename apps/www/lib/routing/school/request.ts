import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { schoolRouting } from "@repo/internationalization/src/routing";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Option } from "effect";
import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { plainTextAnswer } from "@/lib/routing/answer";
import { isLocaleBypassPath } from "@/lib/routing/bypass";
import {
  isRefusedSchoolHost,
  readRequestHostname,
  readSchoolSlug,
} from "@/lib/routing/school/host";
import { isSchoolTreePath, SCHOOL_SEGMENT } from "@/lib/routing/school/tree";

const handleSchoolLocalizedRequest = createMiddleware(schoolRouting);

/**
 * Rewrites a school host's path into the school tree. next-intl picks the
 * locale from the `NEXT_LOCALE` cookie, then `Accept-Language`, then the default,
 * and puts it in front of the rewritten path, so the page renders in that
 * language. The address keeps the host and the path, and school pages are not
 * indexed.
 */
function rewriteToSchool(request: NextRequest, slug: TenantSlug) {
  const { pathname } = request.nextUrl;
  const schoolUrl = request.nextUrl.clone();
  schoolUrl.pathname = `/${SCHOOL_SEGMENT}/${slug}${pathname === "/" ? "" : pathname}`;

  const response = handleSchoolLocalizedRequest(
    new NextRequest(schoolUrl, { headers: request.headers })
  );
  response.headers.set("X-Robots-Tag", "noindex");
  response.headers.set(
    "Vary",
    mergeVaryHeader(Option.fromNullOr(response.headers.get("Vary")), [
      "Accept-Language",
      "Cookie",
    ])
  );
  return response;
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
 * Answers a request that belongs to the school hosts before the public routes
 * see it, or returns nothing so that the public routes answer it. A school host
 * gets its school tree, a label that names no school under the production
 * domain goes to the main site, and the school tree answers 404 everywhere else.
 * The host is the one in the `host` header (see `readRequestHostname`). The root
 * files of the matcher never reach this function, so they are the same on every
 * host.
 */
export function routeSchoolRequest(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = readRequestHostname(request.headers);
  const schoolSlug = Option.flatMap(hostname, readSchoolSlug);
  if (Option.isSome(schoolSlug) && !isLocaleBypassPath(pathname)) {
    return rewriteToSchool(request, schoolSlug.value);
  }
  if (Option.exists(hostname, isRefusedSchoolHost)) {
    return redirectToMainSite(request);
  }
  if (isSchoolTreePath(pathname)) {
    return plainTextAnswer(404, "Not Found\n");
  }
  return null;
}
