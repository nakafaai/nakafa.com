import { query } from "@repo/backend/convex/_generated/server";
import { resolveActiveRoute } from "@repo/backend/convex/contentRelease/scope/route";
import {
  appLocaleValidator,
  contentFamilyValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect } from "effect";

const routeResultValidator = v.union(
  v.object({
    activeReleaseId: v.union(v.string(), v.null()),
    kind: v.literal("unmanaged"),
  }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("missing"),
  }),
  v.object({
    activeReleaseId: v.string(),
    kind: v.literal("found"),
    projectionJson: v.string(),
  })
);
type RouteResult = Infer<typeof routeResultValidator>;
/** Converts the internal route model into its public ownership contract. */
function toRouteResult(
  resolved: Effect.Success<ReturnType<typeof resolveActiveRoute>>
): RouteResult {
  if (!resolved.active) {
    return { activeReleaseId: null, kind: "unmanaged" };
  }
  if (!resolved.managed) {
    return {
      activeReleaseId: resolved.active.releaseId,
      kind: "unmanaged",
    };
  }
  if (!resolved.projection) {
    return {
      activeReleaseId: resolved.active.releaseId,
      kind: "missing",
    };
  }
  return {
    activeReleaseId: resolved.active.releaseId,
    kind: "found",
    projectionJson: resolved.projection.projectionJson,
  };
}
/** Returns active public-route ownership without exposing artifact code. */
export const resolve = query({
  args: {
    family: contentFamilyValidator,
    appLocale: appLocaleValidator,
    publicPath: v.string(),
  },
  returns: routeResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      resolveActiveRoute(
        ctx,
        args.family,
        args.appLocale,
        args.publicPath
      ).pipe(Effect.map(toRouteResult))
    ),
});
