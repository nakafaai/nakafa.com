import type {
  DataModel,
  TableNames,
} from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { loadCutoverState } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Blocks every legacy mutation after cutover initialization. */
export async function legacyContentWriteHandler<TableName extends TableNames>(
  ctx: MutationCtx,
  _change: Change<DataModel, TableName>
) {
  await runConvexProgram(ensureLegacyContentWritable(ctx));
}

/** Rejects legacy mutations while the raw cutover drain owns deletion. */
const ensureLegacyContentWritable = Effect.fn(
  "contentRelease.cutover.ensureLegacyContentWritable"
)(function* (ctx: MutationCtx) {
  const state = yield* loadCutoverState(ctx);
  if (state) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Legacy content writes are frozen for the strict Phase 1 cutover."
    );
  }
  const activity = yield* Effect.promise(() =>
    ctx.db
      .query("contentCutoverActivity")
      .withIndex("by_key", (index) => index.eq("key", "legacy"))
      .unique()
  );
  const updatedAt = Date.now();
  if (!activity) {
    yield* Effect.promise(() =>
      ctx.db.insert("contentCutoverActivity", {
        key: "legacy",
        updatedAt,
        version: 1,
      })
    );
    return;
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverActivity", activity._id, {
      updatedAt,
      version: activity.version + 1,
    })
  );
});
