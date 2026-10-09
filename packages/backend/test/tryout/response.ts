import { assert, expect } from "@effect/vitest";
import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type { TryoutStatus } from "@repo/backend/confect/tryouts/status";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
export type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;
export type ResponseFixture = Effect.Success<
  ReturnType<typeof seedResponseFixture>
>;
/** The public failure a Convex call is expected to reject with. */
export const ExpectedConvexFailure = Schema.Struct({
  code: Schema.String,
  message: Schema.optionalKey(Schema.String),
});
export type ExpectedConvexFailure = typeof ExpectedConvexFailure.Type;
export const setResponseClock = Effect.fn("test.tryout.response.setClock")(
  (offset: number) =>
    Effect.sync(() => vi.setSystemTime(TRYOUT_TEST_NOW + offset))
);
export const readResponseState = Effect.fn("test.tryout.response.readState")(
  (t: ConvexTest, fixture: ResponseFixture) =>
    Effect.promise(() =>
      t.query(async (ctx) => ({
        attempt: await ctx.db.get(fixture.attemptId),
        responses: await ctx.db.query("tryoutResponses").collect(),
        section: await ctx.db.get(fixture.sectionAttemptId),
      }))
    )
);
export const expectConvexFailure = Effect.fn(
  "test.tryout.response.expectFailure"
)(function* (
  operation: () => Promise<unknown>,
  expected: ExpectedConvexFailure
) {
  const result = yield* Effect.result(Effect.tryPromise(operation));
  assert(Result.isFailure(result));
  const failure = result.failure;
  expect(failure.cause).toMatchObject({
    data: expected,
  });
});
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
      const choices =
        placement?.responseSpec.kind === "single-choice"
          ? placement.responseSpec.options
          : [];
      const selectedChoice = Option.getOrThrow(Arr.head(choices));
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
