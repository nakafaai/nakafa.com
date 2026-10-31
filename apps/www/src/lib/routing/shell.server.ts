import { env } from "cloudflare:workers";
import { Effect } from "effect";
import { SHELL_PATH } from "@/lib/routing/shell";

/** The release's browser shell at the visitor's address, with the given status. */
export const answerShell = Effect.fn("www.routing.shell")(function* (
  request: Request,
  status: 200 | 404
) {
  const shell = yield* Effect.promise(() =>
    env.ASSETS.fetch(new Request(new URL(SHELL_PATH, request.url)))
  );
  const headers = new Headers(shell.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(request.method === "HEAD" ? null : shell.body, {
    headers,
    status,
  });
});
