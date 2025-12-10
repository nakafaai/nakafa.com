import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getUserMap } from "../lib/userHelpers";

export function attachForumUsers(
  ctx: QueryCtx,
  forums: Doc<"schoolClassForums">[]
) {
  return getUserMap(
    ctx,
    forums.map((f) => f.createdBy)
  );
}
