import { decideRedirect } from "@repo/internationalization/src/redirect";
import { Effect, Option } from "effect";
import { hasTryoutAttemptCapability } from "@/components/tryout/route/path";
import { readLlmsMarkdownPathname } from "@/lib/llms/routes";
import { readMovedRedirect } from "@/lib/routing/moved";
import { readPublicUrlMigrationRedirect } from "@/lib/routing/public/migration";
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
 * The redirect that answers a request before the router runs, as a Response,
 * or none. The server entry calls it first, so a canonical address never reaches
 * route matching. An address that moved answers first, then the locale rules.
 */
export function readRedirectResponse(
  request: Request
): Option.Option<Response> {
  const url = new URL(request.url);
  return Option.match(readMovedRedirect(url), {
    onNone: () =>
      Option.map(
        decideRedirect({
          headers: request.headers,
          isSchoolHost: Option.isSome(readSchoolSlug(url.hostname)),
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
