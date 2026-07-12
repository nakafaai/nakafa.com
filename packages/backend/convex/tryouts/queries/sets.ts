import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import {
  listCatalogSets,
  listSetsByStatus,
  listUnattemptedSets,
  readReadyTrackParent,
} from "@repo/backend/convex/tryouts/sets/catalog";
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
    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    const auth = await getOptionalAppUser(ctx);

    if (args.sort.field === "publishedScore" && auth) {
      return await listScoreSortedSets(ctx, args, auth.appUser);
    }

    return await listCatalogSets(ctx, args, auth?.appUser ?? null);
  },
});

/** Lists sets matching one exact indexed workflow status. */
export const byStatus = query({
  args: statusArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    const auth = await getOptionalAppUser(ctx);

    if (!auth) {
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
    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    const auth = await getOptionalAppUser(ctx);
    return await listUnattemptedSets(ctx, args, auth?.appUser ?? null);
  },
});
