import { env } from "cloudflare:workers";
import { isSharedPath } from "@repo/internationalization/src/rewrite";
import { Array as Arr, Effect, Option, String as Str } from "effect";
import { readRequestHostname, readSchoolSlug } from "@/lib/routing/school/host";
import { SCHOOL_SHELL_PATH } from "@/lib/routing/school/shell";

/**
 * Whether a request reads a page of a school host: a read of an address that
 * names no file and that no shared route, such as `/api`, owns. A missing file,
 * such as a chunk of an older release, keeps its own not-found answer.
 */
export function isSchoolPageRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  const { pathname } = new URL(request.url);
  const names = Option.getOrElse(Arr.last(pathname.split("/")), () => "");
  return (
    Option.isSome(
      Option.flatMap(readRequestHostname(request.headers), readSchoolSlug)
    ) &&
    !isSharedPath(pathname) &&
    !Str.includes(".")(names)
  );
}

/**
 * Answers a page of a school host with the static shell of the release, at the
 * visitor's address and with the given status. A school renders only in the
 * browser (ADR 0038 D2), so the Worker renders nothing for it: the shell's
 * script reads the school's gate and its page from Convex.
 */
export const answerSchoolShell = Effect.fn("www.routing.school.shell")(
  function* (request: Request, status: 200 | 404) {
    const shell = yield* Effect.promise(() =>
      env.ASSETS.fetch(new Request(new URL(SCHOOL_SHELL_PATH, request.url)))
    );
    const headers = new Headers(shell.headers);
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(request.method === "HEAD" ? null : shell.body, {
      headers,
      status,
    });
  }
);
