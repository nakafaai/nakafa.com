import {
  type GenericActionCtx,
  type GenericDataModel,
  type HttpRouter,
  httpActionGeneric,
  httpRouter,
  type PublicHttpAction,
  ROUTABLE_HTTP_METHODS,
  type RoutableMethod,
} from "convex/server";
import { Array as Arr, Option, Predicate } from "effect";

/** A family's router, which its module builds as it evaluates. */
type LoadRouter = () => Promise<{ readonly default: HttpRouter }>;

/**
 * Every family of HTTP paths and the module that serves it. Convex reuses no context for an
 * action, so each HTTP call evaluates this module and all that it imports, and a family
 * loads only for its own paths: a token read pays for the auth routes and no others.
 */
const FAMILIES = [
  {
    load: () => import("@repo/backend/confect/auth/http"),
    routes: [
      { path: "/.well-known/openid-configuration" },
      { pathPrefix: "/api/auth/" },
    ],
  },
  {
    load: () => import("@repo/backend/confect/contentRelease/http/router"),
    routes: [{ pathPrefix: "/internal/content/" }],
  },
  {
    load: () => import("@repo/backend/confect/integrations/http"),
    routes: [{ pathPrefix: "/api/school/" }],
  },
  {
    load: () => import("@repo/backend/confect/routes/agent/http"),
    routes: [{ path: "/internal/mcp" }, { pathPrefix: "/internal/agent/" }],
  },
  {
    load: () => import("@repo/backend/confect/routes/hooks"),
    routes: [
      { pathPrefix: "/polar/" },
      { pathPrefix: "/resend/" },
      { pathPrefix: "/xendit/" },
    ],
  },
];

/** A route's own handler, which Convex and `convex-test` both run and the published types leave out. */
const hasHandler = (
  route: PublicHttpAction
): route is PublicHttpAction & {
  readonly _handler: (
    ctx: GenericActionCtx<GenericDataModel>,
    request: Request
  ) => Promise<Response>;
} => Predicate.hasProperty(route, "_handler");

/** One path's action here: it evaluates the family's router and runs that router's own route. */
const forwardTo = (load: LoadRouter, method: RoutableMethod) =>
  httpActionGeneric((ctx, request) =>
    load().then(({ default: router }) =>
      Option.fromNullOr(
        router.lookup(new URL(request.url).pathname, method)
      ).pipe(
        Option.map(([route]) => route),
        Option.filter(hasHandler),
        Option.match({
          onNone: () => Promise.resolve(new Response(null, { status: 404 })),
          onSome: (route) => route._handler(ctx, request),
        })
      )
    )
  );

const http = httpRouter();

Arr.forEach(FAMILIES, ({ load, routes }) =>
  Arr.forEach(routes, (route) =>
    Arr.forEach(ROUTABLE_HTTP_METHODS, (method) =>
      http.route({ ...route, handler: forwardTo(load, method), method })
    )
  )
);

export default http;
