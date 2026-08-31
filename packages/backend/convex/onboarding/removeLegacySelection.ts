import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalMutation,
} from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const CLEANUP_PAGE_SIZE = 50;
const CLEANUP_RUN_PAGE_LIMIT = 64;
const cleanupPageFailedCode = "ONBOARDING_LEGACY_CLEANUP_PAGE_FAILED";

/** Expected operational failure while removing one legacy selection page. */
class OnboardingLegacyCleanupError extends Schema.TaggedError<OnboardingLegacyCleanupError>()(
  "OnboardingLegacyCleanupError",
  {
    code: Schema.Literal(cleanupPageFailedCode),
    message: Schema.Literal("Unable to remove the next legacy selection page."),
  }
) {}

/** Runs one cleanup operation through the stable internal error contract. */
function tryLegacySelectionCleanup<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: () =>
      new OnboardingLegacyCleanupError({
        code: cleanupPageFailedCode,
        message: "Unable to remove the next legacy selection page.",
      }),
    try: operation,
  });
}

const cleanupPageResultValidator = v.object({
  alreadyClean: v.number(),
  cleaned: v.number(),
  continueCursor: v.string(),
  isDone: v.boolean(),
});
type CleanupPageResult = Infer<typeof cleanupPageResultValidator>;

const cleanupPageReference = makeFunctionReference<
  "mutation",
  { cursor: string | null },
  CleanupPageResult
>("onboarding/removeLegacySelection:page");

/** Removes retired selection fields from one bounded preference page. */
const removeLegacySelectionPage = Effect.fn(
  "onboarding.removeLegacySelectionPage"
)(function* (ctx: MutationCtx, cursor: string | null) {
  const preferences = yield* tryLegacySelectionCleanup(() =>
    ctx.db
      .query("learningPreferences")
      .paginate({ cursor, numItems: CLEANUP_PAGE_SIZE })
  );
  let alreadyClean = 0;
  let cleaned = 0;

  for (const preference of preferences.page) {
    if (
      preference.learningInterest === undefined &&
      preference.primaryProgramKey === undefined &&
      preference.selectionUpdatedAt === undefined
    ) {
      alreadyClean += 1;
      continue;
    }

    yield* tryLegacySelectionCleanup(() =>
      ctx.db.patch(preference._id, {
        learningInterest: undefined,
        primaryProgramKey: undefined,
        selectionUpdatedAt: undefined,
      })
    );
    cleaned += 1;
  }

  return {
    alreadyClean,
    cleaned,
    continueCursor: preferences.continueCursor,
    isDone: preferences.isDone,
  };
});

/** Drains bounded cleanup pages and returns a cursor when another run is needed. */
const removeLegacySelection = Effect.fn("onboarding.removeLegacySelection")(
  function* (ctx: ActionCtx, initialCursor: string | null) {
    let pageCursor = initialCursor;
    let continueCursor = "";
    let alreadyClean = 0;
    let cleaned = 0;

    for (let index = 0; index < CLEANUP_RUN_PAGE_LIMIT; index += 1) {
      const receipt = yield* tryLegacySelectionCleanup(() =>
        ctx.runMutation(cleanupPageReference, { cursor: pageCursor })
      );
      alreadyClean += receipt.alreadyClean;
      cleaned += receipt.cleaned;
      continueCursor = receipt.continueCursor;
      pageCursor = continueCursor;

      if (receipt.isDone) {
        return {
          alreadyClean,
          cleaned,
          continueCursor,
          isDone: true,
        };
      }
    }

    return {
      alreadyClean,
      cleaned,
      continueCursor,
      isDone: false,
    };
  }
);

/** Removes one bounded page of retired learning-selection fields. */
export const page = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: cleanupPageResultValidator,
  handler: (ctx, { cursor }) =>
    runConvexProgram(removeLegacySelectionPage(ctx, cursor)),
});

/** Drains at most 3,200 preferences and can resume from the returned cursor. */
export const run = internalAction({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: cleanupPageResultValidator,
  handler: (ctx, { cursor }) =>
    runConvexProgram(removeLegacySelection(ctx, cursor)),
});
