import { decideRedirect } from "@repo/internationalization/src/redirect";
import { Option } from "effect";
import { readSchoolSlug } from "@/lib/routing/school/host";

/**
 * The redirect that answers a request before the router runs, as a Response,
 * or none. The server entry calls it first, so a canonical address never reaches
 * route matching.
 */
export function readRedirectResponse(
  request: Request
): Option.Option<Response> {
  const url = new URL(request.url);
  return Option.map(
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
  );
}
