import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import {
  publicBatchResultValidator,
  publicRequestValidator,
  publicResultValidator,
  resolvePublicRoute,
  resolvePublicRoutes,
} from "@repo/backend/content/publication/public";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";
/** Returns one public artifact only to the server-authenticated HTTP adapter. */
export const read = internalQuery({
  args: { appLocale: appLocaleValidator, publicPath: v.string() },
  returns: publicResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      resolvePublicRoute(args.appLocale, args.publicPath).pipe(
        Effect.provide(convexPublicationLayer(ctx))
      )
    ),
});
/** Returns one ordered public batch to the authenticated HTTP adapter. */
export const readBatch = internalQuery({
  args: { requests: v.array(publicRequestValidator) },
  returns: publicBatchResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      resolvePublicRoutes(args.requests).pipe(
        Effect.provide(convexPublicationLayer(ctx))
      )
    ),
});
