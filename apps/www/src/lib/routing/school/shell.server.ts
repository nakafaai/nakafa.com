import { negotiateLocale } from "@repo/internationalization/src/negotiate";
import { isSharedPath } from "@repo/internationalization/src/rewrite";
import { Effect, Option } from "effect";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { hasStaticRelease } from "@/lib/routing/release";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";
import { SHELL_PATH, schoolEntryPath } from "@/lib/routing/shell";
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
export function readsSchoolShell(request: Request) {
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
 * The shell that answers a page of a school host. A visitor with no session at the
 * school's root reads the sign-in, so their shell paints it in the language the page
 * will read in. Every other page is private, or opens another form, and draws in the
 * browser alone (ADR 0038 D2).
 */
function readSchoolShellPath(request: Request) {
  const { pathname, search } = new URL(request.url);
  return pathname === "/" &&
    search === "" &&
    readSessionCookie(request) === null
    ? schoolEntryPath(negotiateLocale(request.headers))
    : SHELL_PATH;
}

/**
 * Answers a page of a school host with the release's static shell and the given
 * status, and any other request with `otherwise`. The Worker renders nothing for a
 * school (ADR 0038 D2): the shell's script reads the school's gate and its page from
 * Convex, and draws a refusal itself.
 */
export const answerSchoolPage = Effect.fn("www.routing.school.page")(function* <
  A,
  E,
  R,
>(request: Request, status: 200 | 404, otherwise: Effect.Effect<A, E, R>) {
  if (readsSchoolShell(request)) {
    return yield* answerShell(request, status, readSchoolShellPath(request));
  }
  return yield* otherwise;
});
