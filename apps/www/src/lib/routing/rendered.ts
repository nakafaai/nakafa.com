import { LocaleSchema } from "@repo/internationalization/src/locale";
import { Array as Arr, Record as Rec, Result, Schema } from "effect";
import { PRERENDERED_ROUTE_TEMPLATES } from "@/lib/routing/prerendered";
import { hasStaticRelease } from "@/lib/routing/release";
import { routeRewrite } from "@/lib/routing/rewrite";
import {
  isBarePath,
  isRenderedPath,
  matchesRouteTemplate,
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

/** The id of the route that holds every page of the main site, under its locale. */
const LOCALE_ROUTE_ID = "/$locale";

/** Whether a route id names the route `root` or a route inside it. */
function isInsideRoute(id: string, root: string): boolean {
  return id === root || id.startsWith(`${root}/`);
}

/**
 * The main site's routes that render only in the browser, `ssr: false` (ADR 0038
 * D2), each with every route inside it. A school's routes say the same, and their
 * School host answers them with the shell on its own path.
 */
const BROWSER_ROUTE_IDS = Arr.map(
  Arr.filter(
    Rec.toEntries(getRouter().routesById),
    ([id, route]) =>
      route.options.ssr === false && isInsideRoute(id, LOCALE_ROUTE_ID)
  ),
  ([id]) => id
);

/** The templates of the routes inside a browser-only route, and the templates of every other route. */
const [BROWSER_TEMPLATES, SERVER_TEMPLATES] = Arr.partition(
  Rec.toEntries(getRouter().routesById),
  ([id, route]) => {
    const template = normalizeRouteTemplate(route.fullPath);
    return Arr.some(BROWSER_ROUTE_IDS, (root) => isInsideRoute(id, root))
      ? Result.succeed(template)
      : Result.fail(template);
  }
);

/**
 * The route templates whose pages render only in the browser. A template that a
 * server-rendered route names too stays out: a layout without a path of its own,
 * such as the account gate, takes its parent's template.
 */
export const BROWSER_ROUTE_TEMPLATES = Arr.filter(
  Arr.dedupe(BROWSER_TEMPLATES),
  (template) => !Arr.contains(SERVER_TEMPLATES, template)
);

/**
 * Reports whether a request address names a page of the main site that renders
 * only in the browser, such as `/en/home` or `/id/user/settings`. A path whose
 * first segment is no locale names none, because the locale route would refuse it.
 */
export function isBrowserRoutePath(url: URL): boolean {
  const { pathname } = routeRewrite.input({ url });
  const [locale] = readPathSegments(pathname);
  return (
    Schema.is(LocaleSchema)(locale) &&
    Arr.some(BROWSER_ROUTE_TEMPLATES, (template) =>
      matchesRouteTemplate(template, pathname)
    )
  );
}
