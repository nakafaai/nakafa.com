import { env } from "cloudflare:workers";
import { isSharedPath } from "@repo/internationalization/src/rewrite";
import { Effect, Option } from "effect";
import { hasStaticRelease } from "@/lib/routing/release";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";
import { SCHOOL_SHELL_PATH } from "@/lib/routing/school/shell";
import { namesFile } from "@/lib/routing/template";

/**
 * Whether the release's static shell answers a request: a read of a school host's
 * address that names no file and that no shared route, such as `/api`, owns. A
 * missing file, such as a chunk of an older release, keeps its own not-found
 * answer. A prerender and a development server bind no release, so their router
 * renders the school's root document instead.
 */
function readsSchoolShell(request: Request) {
  if (!hasStaticRelease()) {
    return false;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  const { pathname } = new URL(request.url);
  return (
    Option.isSome(
      Option.flatMap(readRequestHostname(request.headers), readSchoolSlug)
    ) &&
    !isSharedPath(pathname) &&
    !namesFile(pathname)
  );
}

/** The release's static shell at the visitor's address, with the given status. */
const answerSchoolShell = Effect.fn("www.routing.school.shell")(function* (
  request: Request,
  status: 200 | 404
) {
  const shell = yield* Effect.promise(() =>
    env.ASSETS.fetch(new Request(new URL(SCHOOL_SHELL_PATH, request.url)))
  );
  const headers = new Headers(shell.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(request.method === "HEAD" ? null : shell.body, {
    headers,
    status,
  });
});

/**
 * Answers a page of a school host with the release's static shell and the given
 * status, and any other request with `otherwise`. A school renders only in the
 * browser (ADR 0038 D2), so the Worker renders nothing for it: the shell's script
 * reads the school's gate and its page from Convex, and draws a refusal itself.
 */
export const answerSchoolPage = Effect.fn("www.routing.school.page")(function* <
  A,
  E,
  R,
>(request: Request, status: 200 | 404, otherwise: Effect.Effect<A, E, R>) {
  if (readsSchoolShell(request)) {
    return yield* answerSchoolShell(request, status);
  }
  return yield* otherwise;
});
