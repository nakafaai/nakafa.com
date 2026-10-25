import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import {
  decideRootRedirect,
  decideSlashRedirect,
  decideSpellingRedirect,
  LOCALE_VARY,
} from "@repo/internationalization/src/redirect";
import { isSharedPath } from "@repo/internationalization/src/rewrite";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { siteUrlKeys } from "@repo/site/keys";
import { Array as Arr, Effect, Option } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { readLlmsMarkdownPathname } from "@/lib/llms/routes";
import { readProfileIdAddress } from "@/lib/profile/route";
import { readMovedRedirect } from "@/lib/routing/moved";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { readRetiredPublicRoute } from "@/lib/routing/public/retired";
import {
  isRefusedSchoolHost,
  readRequestHostname,
  readSchoolSlug,
} from "@/lib/routing/school/host";

/**
 * The answer to a retired public address, as a Response, or none. The
 * successor keeps the Markdown suffix and the query string of the request. Only
 * a retired profile address depends on the session cookie, so only its answer
 * says so with `Vary`. The server entry asks this after the school gates and the
 * removed-address answer, and before the moved addresses.
 */
export const readMigrationResponse = Effect.fn("www.routing.migrationResponse")(
  function* (request: Request) {
    const url = new URL(request.url);
    const { markdownExtension, pathname } = readLlmsMarkdownPathname(
      url.pathname
    );
    const migration = yield* readPublicUrlMigrationRedirect({
      hasAttemptCapability: hasTryoutAttemptCapability(url.searchParams),
      headers: request.headers,
      markdown: markdownExtension !== "",
      method: request.method,
      pathname,
    });
    if (migration === null) {
      return Option.none();
    }
    const headers = new Headers({
      location: `${migration.destination}${markdownExtension}${url.search}`,
    });
    if (Option.isSome(readProfileIdAddress(pathname))) {
      headers.set("vary", "Cookie");
    }
    return Option.some(
      new Response(null, { headers, status: migration.status })
    );
  }
);

/**
 * The redirect of a host that sits under the production domain but names no
 * school, such as `www`: the same path and query open on the main site, with a
 * 307 (ADR 0026). Only the path and query move, so a path that starts with two
 * slashes stays on the main site. A shared path, such as the robots file, answers
 * on every host, so the refused host serves it itself. The deployment's own host
 * is its main site and never moves: staging serves `staging.nakafa.com`, whose
 * label no school may take.
 */
export function readMainSiteRedirect(
  request: Request
): Option.Option<Response> {
  const hostname = readRequestHostname(request.headers);
  if (
    Option.isNone(hostname) ||
    !isRefusedSchoolHost(hostname.value) ||
    hostname.value === new URL(siteUrlKeys().SITE_URL).hostname
  ) {
    return Option.none();
  }
  const url = new URL(request.url);
  if (isSharedPath(url.pathname)) {
    return Option.none();
  }
  const target = new URL(SITE_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;
  return Option.some(
    new Response(null, {
      headers: { location: target.href },
      status: 307,
    })
  );
}

/**
 * The locale of the not-found page that answers a public address which is removed
 * for good, or none for an address that stays. The server entry asks this before
 * the migrations, so a removed address never moves to a successor.
 */
export const readRemovedAddressNotFound = Effect.fn(
  "www.routing.removedAddressNotFound"
)(function* (request: Request) {
  const url = new URL(request.url);
  const { pathname } = readLlmsMarkdownPathname(url.pathname);
  const removed = yield* readRetiredPublicRoute({
    hasAttemptCapability: hasTryoutAttemptCapability(url.searchParams),
    pathname,
  });
  return removed
    ? Option.some(negotiateLocale(request.headers))
    : Option.none();
});

/** A first path segment shaped like a locale code, such as `fr` or `EN`. */
const LOCALE_SHAPED_SEGMENT = /^[a-z]{2}$/iu;

/**
 * The redirect of a bare page address, such as `/subjects/physics` or
 * `/@username/chat`: the same address opens in the negotiated locale, which is
 * English when the visitor's languages name none that Nakafa serves, with a 307
 * because the answer depends on the request. The server entry asks this only for
 * a bare address, after the moved addresses. A first segment shaped like a locale
 * code names a locale that Nakafa does not serve, and a last segment with a dot
 * names a file (`/wp-login.php`), so neither names a page and both stay missing.
 */
export function readBareRedirect(request: Request): Option.Option<Response> {
  const url = new URL(request.url);
  const segments = Arr.filter(
    url.pathname.split("/"),
    (segment) => segment !== ""
  );
  const isPage =
    Option.exists(
      Arr.head(segments),
      (first) => !LOCALE_SHAPED_SEGMENT.test(first)
    ) && Option.exists(Arr.last(segments), (last) => !last.includes("."));
  if (!isPage) {
    return Option.none();
  }
  return Option.some(
    new Response(null, {
      headers: {
        location: `/${negotiateLocale(request.headers)}${url.pathname}${url.search}`,
        vary: LOCALE_VARY,
      },
      status: 307,
    })
  );
}

/** The Response of one redirect decision: its location, its status, and its Vary field when it has one. */
function toRedirectResponse(decision: {
  readonly location: string;
  readonly status: 307 | 308;
  readonly vary?: string;
}) {
  return new Response(null, {
    headers:
      decision.vary === undefined
        ? { location: decision.location }
        : { location: decision.location, vary: decision.vary },
    status: decision.status,
  });
}

/**
 * The redirect of a non-canonical slash spelling, as a Response, or none. The
 * server entry asks this before the negotiation, so a Markdown request for a
 * trailing slash moves to the canonical address and never meets a 406.
 */
export function readSlashRedirectResponse(
  request: Request
): Option.Option<Response> {
  return Option.map(
    decideSlashRedirect(new URL(request.url)),
    toRedirectResponse
  );
}

/**
 * The redirect of a non-public spelling of a localized path, such as
 * `/en/curricula` for `/en/curriculum`, as a Response, or none. The server entry
 * asks this before the negotiation, so a Markdown request for the non-public
 * spelling moves to the public address too.
 */
export function readSpellingRedirectResponse(
  request: Request
): Option.Option<Response> {
  const url = new URL(request.url);
  const isSchoolHost = Option.isSome(readSchoolSlug(url.hostname));
  return Option.map(
    decideSpellingRedirect({ isSchoolHost, url }),
    toRedirectResponse
  );
}

/**
 * The redirect of an address that the product moved, as a Response, or none.
 * The server entry asks this before the negotiation: the reference site answered
 * these addresses in its configuration, before any middleware, so a Markdown
 * request for a moved address moves too.
 */
export function readMovedResponse(request: Request): Option.Option<Response> {
  return Option.map(
    readMovedRedirect(new URL(request.url)),
    (moved) =>
      new Response(null, {
        headers: { location: moved.location },
        status: moved.status,
      })
  );
}

/**
 * The redirect of the main site's root to the negotiated locale, as a Response,
 * or none. The server entry asks this after the negotiation, because the answer
 * to a Markdown request does not depend on the locale.
 */
export function readRootRedirectResponse(
  request: Request
): Option.Option<Response> {
  const url = new URL(request.url);
  const isSchoolHost = Option.isSome(readSchoolSlug(url.hostname));
  return Option.map(
    decideRootRedirect({ headers: request.headers, isSchoolHost, url }),
    toRedirectResponse
  );
}
