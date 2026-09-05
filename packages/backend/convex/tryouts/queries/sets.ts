import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  listPublishedSets,
  listPublishedSetsByStatus,
  listPublishedUnattemptedSets,
} from "@repo/backend/convex/tryouts/sets/published";
import {
  emptySetPage,
  listArgsValidator,
  statusArgsValidator,
  trackSetValidator,
  unattemptedArgsValidator,
} from "@repo/backend/convex/tryouts/sets/spec";
import { paginationResultValidator } from "convex/server";
import { Effect } from "effect";

/** Lists one cursor page of ready sets with indexed catalog sorting. */
export const list = query({
  args: listArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(args.locale).pipe(
        Effect.provide(convexTryoutLayer(ctx))
      )
    );
    const auth = await getOptionalAppUserForRead(ctx);
    const normalizedArgs =
      args.sort.field === "publishedScore" && !auth
        ? {
            ...args,
            sort: { direction: "asc" as const, field: "order" as const },
          }
        : args;
    return await runConvexProgram(
      listPublishedSets(ctx, catalog, normalizedArgs, auth?.appUser ?? null)
    );
  },
});

/** Lists sets matching one exact indexed workflow status. */
export const byStatus = query({
  args: statusArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(args.locale).pipe(
        Effect.provide(convexTryoutLayer(ctx))
      )
    );
    const auth = await getOptionalAppUserForRead(ctx);

    if (!auth) {
      return emptySetPage;
    }

    return await runConvexProgram(
      listPublishedSetsByStatus(ctx, catalog, args, auth.appUser)
    );
  },
});

/** Lists ready sets that the current user has not attempted. */
export const unattempted = query({
  args: unattemptedArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(
      loadTryoutCatalog(args.locale).pipe(
        Effect.provide(convexTryoutLayer(ctx))
      )
    );
    const auth = await getOptionalAppUserForRead(ctx);
    return await runConvexProgram(
      listPublishedUnattemptedSets(ctx, catalog, args, auth?.appUser ?? null)
    );
  },
});
