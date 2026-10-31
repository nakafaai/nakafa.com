import { RegisteredConvexFunction } from "@confect/server";
import { assert } from "@effect/vitest";
import schema from "@repo/backend/confect/_generated/schema";
import type { NinaFocus } from "@repo/backend/confect/nina/contract/focus";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createNinaTest } from "@repo/backend/test/nina";
import { activateAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import {
  insertStartedAttempt,
  TRYOUT_NOW,
} from "@repo/backend/test/tryout/world";
import { Effect, type Exit, type Layer } from "effect";

const database = (ctx: MutationCtx) =>
  RegisteredConvexFunction.mutationLayer(schema, ctx);
type DatabaseServices = Layer.Success<ReturnType<typeof database>>;

/**
 * One Nina turn whose Pro owner also owns a finished attempt of the direct-entry fixture set: its
 * entry section finished, unanswered, and its first question focused.
 */
export async function createFocusTest() {
  const nina = await createNinaTest();
  const seed = await nina.t.mutation(async (ctx) => {
    await activateAssessmentTestSnapshot(ctx, { entry: true });
    const attemptId = await insertStartedAttempt(ctx, nina.identity.userId, {
      entry: true,
    });
    await ctx.db.patch("tryoutAttempts", attemptId, {
      completedAt: TRYOUT_NOW + 1,
      endReason: "submitted",
      status: "completed",
    });
    const section = await ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
        query.eq("tryoutAttemptId", attemptId).eq("sectionKey", "section-a")
      )
      .unique();
    const placement = await ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex(
        "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
        (query) =>
          query
            .eq("tryoutAttemptId", attemptId)
            .eq("sectionKey", "section-a")
            .eq("questionOrder", 1)
      )
      .unique();
    assert.ok(
      section && placement,
      "Expected the entry section and its first question."
    );
    await ctx.db.patch("tryoutSectionAttempts", section._id, {
      completedAt: TRYOUT_NOW + 1,
      endReason: "submitted",
      status: "completed",
    });
    await ctx.db.patch("users", nina.identity.userId, { plan: "pro" });
    return { attemptId, placementId: placement._id, sectionId: section._id };
  });
  const focus = {
    kind: "tryout-question",
    attemptId: seed.attemptId,
    placementId: seed.placementId,
  } as const;
  const frozen: NinaFocus = {
    ...focus,
    questionOrder: 1,
    sectionKey: "section-a",
  };
  /** Stores the focus on the fixture turn, or on a later turn of its chat, as admission does for a real ask. */
  const focusTurn = (turnId = nina.turnId) =>
    nina.t.mutation(async (ctx) => {
      const turn = await ctx.db.get("ninaTurns", turnId);
      assert.ok(turn?.page, "Expected one active Nina turn.");
      await ctx.db.patch("ninaTurns", turnId, {
        page: { ...turn.page, nina: { ...turn.page.nina, focus: frozen } },
      });
    });
  /** Exits are not Convex values, so each check runs inside the transaction. */
  const expectExit = <A, E>(
    program: Effect.Effect<A, E, DatabaseServices>,
    check: (exit: Exit.Exit<A, E>) => void
  ) =>
    nina.t.mutation(async (ctx) => {
      check(
        await Effect.runPromiseExit(program.pipe(Effect.provide(database(ctx))))
      );
    });
  return { ...nina, expectExit, focus, focusTurn, frozen, seed };
}
