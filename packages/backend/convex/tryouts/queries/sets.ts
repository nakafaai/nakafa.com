import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import {
  listAttemptedSets,
  listCatalogSets,
  listUnattemptedSets,
  readReadyTrackParent,
} from "@repo/backend/convex/tryouts/sets/catalog";
import {
  emptySetPage,
  listArgsValidator,
  statusArgsValidator,
  trackSetValidator,
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
    return await listCatalogSets(ctx, args, auth?.appUser ?? null);
  },
});

/** Lists attempted sets by indexed latest workflow status. */
export const attempted = query({
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

    return await listAttemptedSets(ctx, args, auth.appUser);
  },
});

/** Lists ready sets that the current user has not attempted. */
export const unattempted = query({
  args: statusArgsValidator.fields,
  returns: paginationResultValidator(trackSetValidator),
  handler: async (ctx, args) => {
    if (!(await readReadyTrackParent(ctx, args))) {
      return emptySetPage;
    }

    const auth = await getOptionalAppUser(ctx);
    return await listUnattemptedSets(ctx, args, auth?.appUser ?? null);
  },
});
