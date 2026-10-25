import { Array as Arr, Record as Rec } from "effect";
import { PRERENDERED_ROUTE_TEMPLATES } from "@/lib/routing/prerendered";
import { hasStaticRelease } from "@/lib/routing/release";
import { routeRewrite } from "@/lib/routing/rewrite";
import {
  isBarePath,
  isRenderedPath,
  readPathSegments,
} from "@/lib/routing/template";
import { getRouter } from "@/router";

/** Writes a route template in one spelling, so a trailing slash of an index route matches its page. */
function normalizeRouteTemplate(template: string): string {
  return `/${Arr.join(readPathSegments(template), "/")}`;
}

/**
 * Every route template of the generated tree, in one spelling, with each one once.
 * The router gives each route its full path when it builds the tree, so the list
 * is read from the router that the Worker uses.
 */
export const ROUTE_TEMPLATES = Arr.dedupe(
  Arr.map(Rec.values(getRouter().routesById), (route) =>
    normalizeRouteTemplate(route.fullPath)
  )
);

const PRERENDERED_TEMPLATES = Arr.map(
  PRERENDERED_ROUTE_TEMPLATES,
  normalizeRouteTemplate
);

/**
 * The route templates that the Worker renders. A prerendered template has an asset
 * for every page it names, so a request that reaches the Worker for one names no page.
 */
export const RENDERED_ROUTE_TEMPLATES = Arr.filter(
  ROUTE_TEMPLATES,
  (template) => !Arr.contains(PRERENDERED_TEMPLATES, template)
);

/**
 * Reports whether the Worker's router renders a request address. The router matches
 * the path that its input rewrite gives, so a profile address (`/{locale}/@name`)
 * matches the user route. Without the static release (a development server, the
 * prerender) every route renders, because no prerendered page is an asset.
 */
export function isRenderedRoutePath(url: URL): boolean {
  if (!hasStaticRelease()) {
    return true;
  }
  const { pathname } = routeRewrite.input({ url });
  return isRenderedPath(pathname, RENDERED_ROUTE_TEMPLATES);
}

/**
 * Reports whether a request address is bare: the path that the router's input
 * rewrite gives names neither the root, a locale nor a Worker route of its own. A
 * School host's path becomes its School tree path, so it is never bare. The
 * answer reads every route template, so it is the same with or without the
 * static release.
 */
export function isBareRoutePath(url: URL): boolean {
  const { pathname } = routeRewrite.input({ url });
  return isBarePath(pathname, ROUTE_TEMPLATES);
}
