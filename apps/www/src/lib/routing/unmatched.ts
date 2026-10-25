import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Option } from "effect";
import { readProfileRoot } from "@/lib/profile/route";

/**
 * The first segments that the Worker answers beyond the locale tree: the server
 * functions, the discovery and API routes, the Markdown index, the School host's
 * tree, and the standalone not-found page. Every other first segment names no route.
 */
const WORKER_ROUTE_SEGMENTS = [
  "_missing",
  "_serverFn",
  ".well-known",
  "api",
  "llms.mdx",
  "school",
  "skill.md",
] as const;

/**
 * Reports whether a request path names no route of the app. The Worker answers
 * such a path with the static not-found page before the router runs, so a probe
 * for a file the app never had costs no render. The root path, every
 * locale-prefixed path and a bare profile address (`/@name`, which redirects to
 * the negotiated locale) reach the decisions of the Worker.
 */
export function isUnmatchedPath(pathname: string): boolean {
  const [first] = Arr.filter(pathname.split("/"), (segment) => segment !== "");
  if (first === undefined || Option.isSome(readProfileRoot(first))) {
    return false;
  }
  return !Arr.contains([...LOCALES, ...WORKER_ROUTE_SEGMENTS], first);
}
