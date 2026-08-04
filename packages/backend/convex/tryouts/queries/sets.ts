import { query } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import {
  listCatalogSets,
  listSetsByStatus,
  listUnattemptedSets,
  readReadyTrackParent,
} from "@repo/backend/convex/tryouts/sets/catalog";
import {
  listPublishedSets,
  listPublishedSetsByStatus,
  listPublishedUnattemptedSets,
} from "@repo/backend/convex/tryouts/sets/published";
import { listScoreSortedSets } from "@repo/backend/convex/tryouts/sets/score";
import {
  emptySetPage,
  listArgsValidator,
  statusArgsValidator,
  trackSetValidator,
  unattemptedArgsValidator,
} from "@repo/backend/convex/tryouts/sets/spec";
import { paginationResultValidator } from "convex/server";

/** Lists one cursor page of ready sets with indexed catalog sorting. */
export const list = query({
  args: listArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    const auth = await getOptionalAppUserForRead(ctx);
    if (catalog.managed) {
      if (args.sort.field === "publishedScore" && !auth) {
        return await runConvexProgram(
          listPublishedSets(
            ctx,
            catalog,
            { ...args, sort: { direction: "asc", field: "order" } },
            null
          )
        );
      }
      return await runConvexProgram(
        listPublishedSets(ctx, catalog, args, auth?.appUser ?? null)
      );
    }

    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    if (args.sort.field === "publishedScore") {
      if (auth) {
        return await listScoreSortedSets(ctx, args, auth.appUser);
      }

      return await listCatalogSets(
        ctx,
        { ...args, sort: { direction: "asc", field: "order" } },
        null
      );
    }

    return await listCatalogSets(ctx, args, auth?.appUser ?? null);
  },
});

/** Lists sets matching one exact indexed workflow status. */
export const byStatus = query({
  args: statusArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    const auth = await getOptionalAppUserForRead(ctx);

    if (!auth) {
      return emptySetPage;
    }

    if (catalog.managed) {
      return await runConvexProgram(
        listPublishedSetsByStatus(ctx, catalog, args, auth.appUser)
      );
    }

    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    return await listSetsByStatus(ctx, args, auth.appUser);
  },
});

/** Lists ready sets that the current user has not attempted. */
export const unattempted = query({
  args: unattemptedArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    const catalog = await runConvexProgram(loadTryoutCatalog(ctx, args.locale));
    const auth = await getOptionalAppUserForRead(ctx);
    if (catalog.managed) {
      return await runConvexProgram(
        listPublishedUnattemptedSets(ctx, catalog, args, auth?.appUser ?? null)
      );
    }

    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    return await listUnattemptedSets(ctx, args, auth?.appUser ?? null);
  },
});
