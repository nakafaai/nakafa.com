import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  observeTryoutResponseContract,
  tryoutResponseContractValidator,
} from "@repo/backend/convex/tryouts/response/contract";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { readSectionAttemptState } from "@repo/backend/convex/tryouts/runtime/section/state";
import { readSetAttemptState } from "@repo/backend/convex/tryouts/runtime/set/state";
import { tryoutRuntimeStateValidator } from "@repo/backend/convex/tryouts/runtime/spec";
import { v } from "convex/values";

/** Loads compact mutable set state through one exact owned attempt ID. */
export const getSetAttemptState = query({
  args: {
    attemptId: v.id("tryoutAttempts"),
    responseContract: tryoutResponseContractValidator,
  },
  returns: v.union(v.null(), tryoutRuntimeStateValidator),
  handler: async (ctx, args) => {
    const state = await runConvexProgram(
      readSetAttemptState(ctx, args.attemptId)
    );
    if (state) {
      observeTryoutResponseContract(args.responseContract);
    }
    return state;
  },
});

/** Loads compact mutable section state through one exact owned attempt ID. */
export const getSectionAttemptState = query({
  args: {
    attemptId: v.id("tryoutAttempts"),
    responseContract: tryoutResponseContractValidator,
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.union(v.null(), tryoutRuntimeStateValidator),
  handler: async (ctx, args) => {
    const state = await runConvexProgram(readSectionAttemptState(ctx, args));
    if (state) {
      observeTryoutResponseContract(args.responseContract);
    }
    return state;
  },
});
