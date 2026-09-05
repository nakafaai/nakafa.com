import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  readRouteOwnership,
  routeResultValidator,
} from "@repo/backend/content/publication/route";
import { query } from "@repo/backend/convex/_generated/server";
import {
  appLocaleValidator,
  contentFamilyValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

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
      readRouteOwnership(args.family, args.appLocale, args.publicPath).pipe(
        Effect.provide(convexPublicationLayer(ctx))
      )
    ),
});
