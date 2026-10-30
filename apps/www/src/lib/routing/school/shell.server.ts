import { isSharedPath } from "@repo/internationalization/src/rewrite";
import { Effect, Option } from "effect";
import { hasStaticRelease } from "@/lib/routing/release";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";
import { answerShell } from "@/lib/routing/shell.server";
import { namesFile } from "@/lib/routing/template";
import { answerUnmatchedRequest } from "@/lib/routing/unmatched.server";

/**
 * The path of a read of a school host's address that no shared route, such as
 * `/api`, owns, or none. A prerender and a development server bind no release, so
 * their router answers every school address instead.
 */
function readSchoolHostPath(request: Request): Option.Option<string> {
  if (
    !hasStaticRelease() ||
    (request.method !== "GET" && request.method !== "HEAD")
  ) {
    return Option.none();
  }
  const { pathname } = new URL(request.url);
  return Option.isSome(
    Option.flatMap(readRequestHostname(request.headers), readSchoolSlug)
  ) && !isSharedPath(pathname)
    ? Option.some(pathname)
    : Option.none();
}

/** Whether the release's static shell answers a request: a school host's page, an address that names no file. */
function readsSchoolShell(request: Request) {
  return Option.exists(
    readSchoolHostPath(request),
    (pathname) => !namesFile(pathname)
  );
}

/**
 * The static not-found page for a file that a school host's address names, or
 * none. The release's own files are assets, which never reach the Worker, so the
 * file is missing: a chunk of an older release, or a scanner's probe such as
 * `/.env`. It answers before the school's refusal read and the router, which
 * would render a page for it.
 */
export const readSchoolFile = Effect.fn("www.routing.school.file")(function* (
  request: Request
) {
  if (!Option.exists(readSchoolHostPath(request), namesFile)) {
    return Option.none<Response>();
  }
  return Option.some(yield* answerUnmatchedRequest(request));
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
    return yield* answerShell(request, status);
  }
  return yield* otherwise;
});
