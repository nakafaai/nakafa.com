import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { TryoutStatus } from "@repo/backend/confect/tryouts/status";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";
export type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;
export const seedResponseFixture = Effect.fn(
  "test.tryout.response.seedFixture"
)(function* (
  t: ConvexTest,
  suffix: string,
  status: {
    readonly attempt?: TryoutStatus;
    readonly section?: TryoutStatus;
  } = {}
) {
  const seeded = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const state = await seedTryoutContentAccessState(ctx, {
        attemptStatus: status.attempt ?? "in-progress",
        sectionStatus: status.section ?? "in-progress",
        suffix,
      });
      const placement = await ctx.db.get(state.placementId);
      const selectedChoice =
        placement?.responseSpec.kind === "single-choice"
          ? placement.responseSpec.options.at(0)
          : undefined;
      if (!selectedChoice) {
        throw new Error("Expected one frozen choice.");
      }
      return {
        ...state,
        selectedChoice,
      };
    })
  );
  return {
    ...seeded,
    client: authenticate(t, seeded.identity),
  };
});
export function authenticate(
  t: ConvexTest,
  identity: {
    readonly authUserId: string;
    readonly sessionId: string;
  }
) {
  return t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
}
