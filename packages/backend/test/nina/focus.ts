import { RegisteredConvexFunction } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import type { NinaFocus } from "@repo/backend/confect/nina/contract/focus";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createNinaTest } from "@repo/backend/test/nina";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { Effect, type Exit, type Layer } from "effect";

const database = (ctx: MutationCtx) =>
  RegisteredConvexFunction.mutationLayer(schema, ctx);
type DatabaseServices = Layer.Success<ReturnType<typeof database>>;

/** One Nina turn whose Pro owner also owns a finished single-question attempt. */
export async function createFocusTest() {
  const nina = await createNinaTest();
  const seed = await nina.t.mutation(async (ctx) => {
    const seeded = await insertHistoryAttempt(ctx);
    await ctx.db.patch("tryoutAttempts", seeded.request.attemptId, {
      userId: nina.identity.userId,
    });
    await ctx.db.patch("users", nina.identity.userId, { plan: "pro" });
    return seeded;
  });
  const focus = {
    kind: "tryout-question",
    attemptId: seed.request.attemptId,
    placementId: seed.placementId,
  } as const;
  const frozen: NinaFocus = {
    ...focus,
    questionOrder: seed.fixture.placement.questionOrder,
    sectionKey: seed.fixture.placement.sectionKey,
  };
  /** Stores the focus on the fixture turn, as admission does for a real ask. */
  const focusTurn = () =>
    nina.t.mutation(async (ctx) => {
      const turn = await ctx.db.get("ninaTurns", nina.turnId);
      if (!turn?.page) {
        throw new Error("Expected one active Nina turn.");
      }
      await ctx.db.patch("ninaTurns", nina.turnId, {
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
