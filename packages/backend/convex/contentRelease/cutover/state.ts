import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type CutoverPhase = Infer<typeof cutoverPhaseValidator>;
type ReadCtx = Pick<MutationCtx | QueryCtx, "db">;

/** Reads the single temporary cutover checkpoint through its exact identity. */
export const loadCutoverState = Effect.fn("contentRelease.cutover.loadState")(
  function* (ctx: ReadCtx) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentCutoverState")
        .withIndex("by_key", (index) => index.eq("key", "phase1"))
        .unique()
    );
  }
);

/** Requires the exact durable phase accepted by one cutover operation. */
export const requireCutoverPhase = Effect.fn(
  "contentRelease.cutover.requirePhase"
)(function* (ctx: ReadCtx, phases: readonly CutoverPhase[]) {
  const state = yield* loadCutoverState(ctx);
  if (!(state && phases.includes(state.phase))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Cutover requires phase ${phases.join(" or ")}.`
    );
  }
  return state;
});
