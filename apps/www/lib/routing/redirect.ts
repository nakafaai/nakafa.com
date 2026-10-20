import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import {
  decideRedirect,
  LOCALE_VARY,
} from "@repo/internationalization/src/redirect";
import { Effect, Option } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { readLlmsMarkdownPathname } from "@/lib/llms/routes";
import { readProfileRoot } from "@/lib/profile/route";
import { readMovedRedirect } from "@/lib/routing/moved";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
import { readRetiredPublicRoute } from "@/lib/routing/public/retired";
import { readSchoolSlug } from "@/lib/routing/school/host";

/**
 * The answer to a retired public address, as a Response, or none. The
 * successor keeps the Markdown suffix and the query string of the request. A
 * retired profile address depends on the session cookie, so the answer says so
 * with `Vary`. The server entry asks this before any other redirect.
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
    return Option.some(
      new Response(null, {
        headers: {
          location: `${migration.destination}${markdownExtension}${url.search}`,
          vary: "Cookie",
        },
        status: migration.status,
      })
    );
  }
);

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

/**
 * The redirect of a profile address that names no locale, such as `/@username`
 * or `/@username/chat`: the same address opens in the negotiated locale, with a
 * 307 because the answer depends on the request. A school host has no profile
 * address, so its paths keep their own rules.
 */
function readBareProfileRedirect(
  url: URL,
  headers: Headers,
  isSchoolHost: boolean
): Option.Option<Response> {
  const [, root = ""] = url.pathname.split("/");
  if (isSchoolHost || Option.isNone(readProfileRoot(root))) {
    return Option.none();
  }
  return Option.some(
    new Response(null, {
      headers: {
        location: `/${negotiateLocale(headers)}${url.pathname}${url.search}`,
        vary: LOCALE_VARY,
      },
      status: 307,
    })
  );
}

/**
 * The redirect that answers a request before the router runs, as a Response,
 * or none. The server entry calls it first, so a canonical address never reaches
 * route matching. An address that moved answers first, then the bare profile
 * address, then the locale rules.
 */
export function readRedirectResponse(
  request: Request
): Option.Option<Response> {
  const url = new URL(request.url);
  const isSchoolHost = Option.isSome(readSchoolSlug(url.hostname));
  return Option.match(readMovedRedirect(url), {
    onNone: () =>
      Option.orElse(
        readBareProfileRedirect(url, request.headers, isSchoolHost),
        () =>
          Option.map(
            decideRedirect({
              headers: request.headers,
              isSchoolHost,
              url,
            }),
            (decision) =>
              new Response(null, {
                headers:
                  decision.vary === undefined
                    ? { location: decision.location }
                    : { location: decision.location, vary: decision.vary },
                status: decision.status,
              })
          )
      ),
    onSome: (moved) =>
      Option.some(
        new Response(null, {
          headers: { location: moved.location },
          status: moved.status,
        })
      ),
  });
}
