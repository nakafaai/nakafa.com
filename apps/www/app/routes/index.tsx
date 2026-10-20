import { decideRedirect } from "@repo/internationalization/src/redirect";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Option } from "effect";

/**
 * Decides the root's redirect on the server, with the shared locale contract:
 * the negotiated locale, the request's query string and the `Vary` headers. The
 * root always has a decision, so the no-redirect branch is never taken.
 */
const readRootRedirect = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  return Option.match(
    decideRedirect({ headers: request.headers, url: new URL(request.url) }),
    {
      onNone: () => ({ _tag: "Render" as const }),
      onSome: (decision) => ({
        _tag: "Redirect" as const,
        href: decision.location,
        status: decision.status,
        vary: decision.vary,
      }),
    }
  );
});

/**
 * The site root answers with a redirect to the negotiated locale. The answer
 * depends on the cookie and the language header, so the response says so with
 * `Vary`, as the shared contract does.
 */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const decision = await readRootRedirect();
    if (decision._tag === "Render") {
      return;
    }
    throw redirect({
      href: decision.href,
      statusCode: decision.status,
      ...(decision.vary === undefined
        ? {}
        : { headers: { Vary: decision.vary } }),
    });
  },
});
