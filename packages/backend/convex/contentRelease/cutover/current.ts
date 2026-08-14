import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { CUTOVER_ACTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { cutoverPhaseValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import { loadCutoverState } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type CutoverPhase = Infer<typeof cutoverPhaseValidator>;
interface DrainPageResult {
  readonly complete: boolean;
  readonly deleted: number;
  readonly phase: CutoverPhase;
  readonly preserved: number;
  readonly table: null | string;
}

const drainResultValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
  phase: cutoverPhaseValidator,
  preserved: v.number(),
  table: v.union(v.null(), v.string()),
});
const phaseReference = makeFunctionReference<
  "query",
  Record<string, never>,
  CutoverPhase | null
>("contentRelease/cutover/current:phase");
const pageReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  DrainPageResult
>("contentRelease/cutover/currentPage:page");

/** Reads only the durable phase for current-store drain orchestration. */
export const phase = internalQuery({
  args: {},
  returns: v.union(v.null(), cutoverPhaseValidator),
  handler: (ctx) =>
    runConvexProgram(
      loadCutoverState(ctx).pipe(Effect.map((state) => state?.phase ?? null))
    ),
});

/** Runs a bounded number of crash-safe current-store deletion transactions. */
export const drainCurrent = internalAction({
  args: {},
  returns: drainResultValidator,
  handler: (ctx) => runConvexActionProgram(drainCurrentProgram(ctx)),
});

/** Resumes only after freeze has durably removed the publication pointer. */
const drainCurrentProgram = Effect.fn("contentRelease.cutover.drainCurrent")(
  function* (ctx: ActionCtx) {
    const durablePhase = yield* callInternal(() =>
      ctx.runQuery(phaseReference, {})
    );
    if (durablePhase === "complete" || durablePhase === "proved") {
      return {
        complete: true,
        deleted: 0,
        phase: durablePhase,
        preserved: 0,
        table: null,
      };
    }
    if (durablePhase !== "frozen" && durablePhase !== "draining-current") {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Current content drain requires the durable frozen phase."
      );
    }
    let deleted = 0;
    let preserved = 0;
    let latest: DrainPageResult = {
      complete: false,
      deleted: 0,
      phase: durablePhase,
      preserved: 0,
      table: null,
    };
    for (let index = 0; index < CUTOVER_ACTION_PAGE_LIMIT; index += 1) {
      const result = yield* callInternal(() =>
        ctx.runMutation(pageReference, {})
      );
      deleted += result.deleted;
      preserved += result.preserved;
      latest = { ...result, deleted, preserved };
      if (result.complete) {
        return latest;
      }
    }
    return latest;
  }
);
