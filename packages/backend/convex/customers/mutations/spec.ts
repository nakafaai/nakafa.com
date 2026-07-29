import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";

/** Transactional outcome of attempting to persist one Polar customer. */
export const customerUpsertResultValidator = v.union(
  v.object({
    customerId: vv.id("customers"),
    kind: v.literal("stored"),
  }),
  v.object({ kind: v.literal("deleted") }),
  v.object({ kind: v.literal("missing") }),
  v.object({ kind: v.literal("prepared") })
);

export type CustomerUpsertResult = Infer<typeof customerUpsertResultValidator>;
