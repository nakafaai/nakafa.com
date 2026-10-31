import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { clientEnv } from "@/env.public";
import { SHELL_PATH } from "@/lib/routing/shell";

/**
 * The release's browser shell at the visitor's address, with the given status. Its
 * `Link` header opens the connection to Convex while the shell's scripts load, so
 * the page's first read, which it makes as soon as it runs, finds it open.
 */
export const answerShell = Effect.fn("www.routing.shell")(function* (
  request: Request,
  status: 200 | 404
) {
  const shell = yield* Effect.promise(() =>
    env.ASSETS.fetch(new Request(new URL(SHELL_PATH, request.url)))
  );
  const headers = new Headers(shell.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.append(
    "Link",
    `<${new URL(clientEnv.VITE_CONVEX_URL).origin}>; rel=preconnect; crossorigin`
  );
  return new Response(request.method === "HEAD" ? null : shell.body, {
    headers,
    status,
  });
});
