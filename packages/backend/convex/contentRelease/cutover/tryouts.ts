import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { loadCutoverState } from "@repo/backend/convex/contentRelease/cutover/state";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

type ReadCtx = Pick<MutationCtx | QueryCtx, "db">;

/** Stable failure raised when mutable try-out state is frozen for cutover. */
export class TryoutCutoverError
  extends Schema.TaggedError<TryoutCutoverError>()("TryoutCutoverError", {
    code: Schema.Literal("TRYOUT_CUTOVER_FROZEN"),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: "TRYOUT_CUTOVER_FROZEN";
  declare readonly message: string;
}

/** Blocks every mutable try-out lifecycle after cutover initialization. */
export const ensureTryoutLifecycleWritable = Effect.fn(
  "contentRelease.cutover.ensureTryoutLifecycleWritable"
)(function* (ctx: ReadCtx) {
  const state = yield* loadCutoverState(ctx);
  if (!state) {
    return;
  }
  return yield* new TryoutCutoverError({
    code: "TRYOUT_CUTOVER_FROZEN",
    message: "Try-out lifecycle is frozen for the strict Phase 1 cutover.",
  });
});
