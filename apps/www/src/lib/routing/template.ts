import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Schema } from "effect";

/** The route template segment that takes the rest of a path, which TanStack names `$`. */
const SPLAT_SEGMENT = "$";

/** The first path segment of Start's server functions, which no route template names. */
const SERVER_FUNCTION_SEGMENT = "_serverFn";

/** The non-empty segments of a path or of a route template. */
export function readPathSegments(path: string): readonly string[] {
  return Arr.filter(path.split("/"), (segment) => segment !== "");
}

/**
 * Reports whether a route template matches a path. A `$name` segment takes one
 * segment, a static segment must be equal, and the splat `$` takes the rest of
 * the path. A trailing slash changes nothing.
 */
export function matchesRouteTemplate(
  template: string,
  pathname: string
): boolean {
  const pathSegments = readPathSegments(pathname);
  const templateSegments = readPathSegments(template);
  const splat = Arr.findFirstIndex(
    templateSegments,
    (segment) => segment === SPLAT_SEGMENT
  );
  if (Option.isSome(splat)) {
    return (
      pathSegments.length >= splat.value &&
      matchesSegments(Arr.take(templateSegments, splat.value), pathSegments)
    );
  }
  return (
    pathSegments.length === templateSegments.length &&
    matchesSegments(templateSegments, pathSegments)
  );
}

/** Reports whether each template segment takes or equals the path segment at its place. */
function matchesSegments(
  templateSegments: readonly string[],
  pathSegments: readonly string[]
): boolean {
  return Arr.every(
    Arr.zip(templateSegments, pathSegments),
    ([segment, actual]) => segment.startsWith("$") || segment === actual
  );
}

/**
 * Reports whether a path names neither the root, a locale nor a Worker route of
 * its own, such as `/subjects/physics` or `/wp-login.php`. A Worker route of its
 * own is a server function or a route whose template starts with the same static
 * segment: an API route, the School tree, a discovery file.
 */
export function isBarePath(
  pathname: string,
  templates: readonly string[]
): boolean {
  const [first] = readPathSegments(pathname);
  if (
    first === undefined ||
    first === SERVER_FUNCTION_SEGMENT ||
    Schema.is(LocaleSchema)(first)
  ) {
    return false;
  }
  return !Arr.some(
    templates,
    (template) => readPathSegments(template)[0] === first
  );
}

/**
 * Reports whether the Worker's router renders a path. A locale path is rendered
 * only when one of the Worker's route templates matches it, and every other
 * locale path names no page that the Worker has to render. Any other path is
 * rendered unless it is bare, because it names a Worker route of its own.
 */
export function isRenderedPath(
  pathname: string,
  renderedTemplates: readonly string[]
): boolean {
  const [first] = readPathSegments(pathname);
  if (first === undefined || !Schema.is(LocaleSchema)(first)) {
    return !isBarePath(pathname, renderedTemplates);
  }
  return Arr.some(renderedTemplates, (template) =>
    matchesRouteTemplate(template, pathname)
  );
}
