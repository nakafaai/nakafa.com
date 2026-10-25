import { Array as Arr, Record as Rec } from "effect";
import { PRERENDERED_ROUTE_TEMPLATES } from "@/lib/routing/prerendered";
import { HAS_STATIC_RELEASE } from "@/lib/routing/release";
import { isRenderedPath, readPathSegments } from "@/lib/routing/template";
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
 * Reports whether the Worker's router renders a request path. Without the static
 * release (a development server, the prerender, a preview) every route renders,
 * because no prerendered page is an asset.
 */
export function isRenderedRoutePath(pathname: string): boolean {
  return (
    !HAS_STATIC_RELEASE || isRenderedPath(pathname, RENDERED_ROUTE_TEMPLATES)
  );
}
