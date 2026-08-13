import type {
  DataModel,
  TableNames,
} from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureTryoutLifecycleWritable } from "@repo/backend/convex/contentRelease/cutover/tryouts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Change } from "convex-helpers/server/triggers";

/** Enforces the durable cutover guard at every mutable try-out table seam. */
export async function tryoutLifecycleHandler<TableName extends TableNames>(
  ctx: MutationCtx,
  _change: Change<DataModel, TableName>
) {
  await runConvexProgram(ensureTryoutLifecycleWritable(ctx));
}
