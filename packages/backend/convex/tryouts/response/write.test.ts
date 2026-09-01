import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { saveTryoutResponse } from "@repo/backend/convex/tryouts/response/write";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/status";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;

const seedResponseFixture = Effect.fn("test.tryout.response.seedFixture")(
  function* (
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
        const selectedChoice = placement?.choiceSnapshots?.at(0);
        if (!selectedChoice) {
          throw new Error("Expected one frozen choice.");
        }
        return {
          ...state,
          selectedChoice,
        };
      })
    );
    return { ...seeded, client: authenticate(t, seeded.identity) };
  }
);

function authenticate(
  t: ConvexTest,
  identity: { readonly authUserId: string; readonly sessionId: string }
) {
  return t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
}

type ResponseFixture = Effect.Success<ReturnType<typeof seedResponseFixture>>;
interface ExpectedConvexFailure {
  readonly code: string;
  readonly message?: string;
}

const setResponseClock = Effect.fn("test.tryout.response.setClock")(
  (offset: number) =>
    Effect.sync(() => vi.setSystemTime(new Date(TRYOUT_TEST_NOW + offset)))
);

const saveSelection = Effect.fn("test.tryout.response.saveSelection")(
  (
    fixture: ResponseFixture,
    selectedOptionId = fixture.selectedChoice.optionKey,
    client = fixture.client
  ) =>
    Effect.promise(() =>
      client.mutation(api.tryouts.mutations.responses.save, {
        placementId: fixture.placementId,
        selectedOptionId,
      })
    )
);

const collectResponses = Effect.fn("test.tryout.response.collect")(
  (t: ConvexTest) =>
    Effect.promise(() =>
      t.query((ctx) => ctx.db.query("tryoutResponses").collect())
    )
);

const readResponseState = Effect.fn("test.tryout.response.readState")(
  (t: ConvexTest, fixture: ResponseFixture) =>
    Effect.promise(() =>
      t.query(async (ctx) => ({
        attempt: await ctx.db.get(fixture.attemptId),
        responses: await ctx.db.query("tryoutResponses").collect(),
        section: await ctx.db.get(fixture.sectionAttemptId),
      }))
    )
);

const expectConvexFailure = Effect.fn("test.tryout.response.expectFailure")(
  function* (
    operation: () => Promise<unknown>,
    expected: ExpectedConvexFailure
  ) {
    const failure = yield* Effect.tryPromise(operation).pipe(Effect.flip);
    expect(failure.cause).toMatchObject({
      data: expected,
    });
  }
);

const expectSaveFailure = Effect.fn("test.tryout.response.expectSaveFailure")(
  function* (
    fixture: ResponseFixture,
    expected: ExpectedConvexFailure,
    selectedOptionId = fixture.selectedChoice.optionKey,
    client = fixture.client
  ) {
    yield* expectConvexFailure(
      () =>
        client.mutation(api.tryouts.mutations.responses.save, {
          placementId: fixture.placementId,
          selectedOptionId,
        }),
      expected
    );
  }
);

describe("tryouts/response/write", () => {
  it.effect(
    "stores only the canonical response and preserves first-answer time",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "response-time");

        yield* setResponseClock(5000);
        yield* saveSelection(seeded);

        yield* setResponseClock(9000);
        yield* saveSelection(seeded);

        const stored = yield* readResponseState(t, seeded);
        expect(stored.responses).toHaveLength(1);
        expect(stored.responses[0]).toMatchObject({
          answeredAt: TRYOUT_TEST_NOW + 5000,
          isComplete: true,
          isCorrect: seeded.selectedChoice.isCorrect,
          selection: {
            kind: "single-choice",
            optionKey: seeded.selectedChoice.optionKey,
          },
          timeSpent: 9,
          updatedAt: TRYOUT_TEST_NOW + 9000,
        });
        expect(stored.responses[0]).not.toHaveProperty("selectedOptionId");
        expect(stored.section).toMatchObject({
          answeredCount: 1,
          correctAnswers: seeded.selectedChoice.isCorrect ? 1 : 0,
          lastActivityAt: TRYOUT_TEST_NOW + 9000,
        });
        expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW + 9000);
      })
  );

  it.effect(
    "rejects choices outside the frozen placement without mutating state",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "response-choice");
        yield* setResponseClock(5000);

        for (const selectedOptionId of ["", "option-999"]) {
          yield* expectSaveFailure(
            seeded,
            { code: "TRYOUT_RESPONSE_SELECTION_INVALID" },
            selectedOptionId
          );
        }

        const stored = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            responses: await ctx.db.query("tryoutResponses").collect(),
            section: await ctx.db.get(seeded.sectionAttemptId),
          }))
        );
        expect(stored.responses).toEqual([]);
        expect(stored.section).toMatchObject({
          answeredCount: 0,
          correctAnswers: 0,
          lastActivityAt: TRYOUT_TEST_NOW,
        });
      })
  );

  it.effect(
    "accepts the pre-expiry boundary and rejects expiry without overwrite",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "response-expiry");

        yield* setResponseClock(1_799_999);
        yield* saveSelection(seeded);
        yield* setResponseClock(1_800_000);
        yield* expectSaveFailure(seeded, { code: "TRYOUT_EXPIRED" });

        const responses = yield* collectResponses(t);
        expect(responses).toHaveLength(1);
        expect(responses[0]).toMatchObject({
          answeredAt: TRYOUT_TEST_NOW + 1_799_999,
          selection: {
            kind: "single-choice",
            optionKey: seeded.selectedChoice.optionKey,
          },
          timeSpent: 1799,
          updatedAt: TRYOUT_TEST_NOW + 1_799_999,
        });
      })
  );

  it.effect("rejects a different user before writing a response", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "response-owner");
      const outsider = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: TRYOUT_TEST_NOW,
            suffix: "response-outsider",
          })
        )
      );

      yield* expectSaveFailure(
        seeded,
        { code: "TRYOUT_ATTEMPT_NOT_FOUND" },
        undefined,
        authenticate(t, outsider)
      );
      const responses = yield* collectResponses(t);
      expect(responses).toEqual([]);
    })
  );

  it.effect("masks an unexpected attempt lookup failure", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "response-storage-failure");

      yield* expectConvexFailure(
        () =>
          t.mutation(async (ctx) => {
            const placement = await ctx.db.get(seeded.placementId);
            if (!placement) {
              throw new Error("Expected one frozen placement.");
            }
            const get = vi.spyOn(ctx.db, "get");
            get.mockResolvedValueOnce(placement);
            get.mockRejectedValueOnce(
              new Error("internal tryoutAttempts storage details")
            );

            return await runConvexProgram(
              saveTryoutResponse(ctx, {
                args: {
                  placementId: seeded.placementId,
                  selectedOptionId: seeded.selectedChoice.optionKey,
                },
                now: TRYOUT_TEST_NOW + 5000,
                userId: seeded.identity.userId,
              })
            );
          }),
        {
          code: "TRYOUT_RESPONSE_FAILED",
          message: "Unable to save try-out response.",
        }
      );
    })
  );

  it.effect.each([
    {
      expectedCode: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      status: { attempt: "completed" as const },
      suffix: "inactive-attempt",
    },
    {
      expectedCode: "TRYOUT_SECTION_NOT_ACTIVE",
      status: { section: "completed" as const },
      suffix: "inactive-section",
    },
  ])(
    "rejects $suffix before writing a response",
    ({ expectedCode, status, suffix }) =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, suffix, status);

        yield* expectSaveFailure(seeded, { code: expectedCode });
        const responses = yield* collectResponses(t);
        expect(responses).toEqual([]);
      })
  );

  it.effect.each([
    {
      expectedCode: "TRYOUT_RESPONSE_LINK_MISMATCH",
      suffix: "placement-snapshot-mismatch",
      target: "placement" as const,
    },
    {
      expectedCode: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      suffix: "section-snapshot-mismatch",
      target: "section" as const,
    },
  ])(
    "rejects a $target snapshot mismatch before writing a response",
    ({ expectedCode, suffix, target }) =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, suffix);
        yield* Effect.promise(() =>
          t.mutation((ctx) => {
            if (target === "placement") {
              return ctx.db.patch(seeded.placementId, {
                sectionIdentity: "corrupt-section-identity",
              });
            }

            return ctx.db.patch(seeded.sectionAttemptId, { sectionOrder: 999 });
          })
        );
        yield* expectSaveFailure(seeded, { code: expectedCode });
        const stored = yield* readResponseState(t, seeded);
        expect(stored.responses).toEqual([]);
        expect(stored.section).toMatchObject({
          answeredCount: 0,
          correctAnswers: 0,
          lastActivityAt: TRYOUT_TEST_NOW,
        });
        expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
      })
  );

  it.effect(
    "rejects a cross-linked existing response without counter changes",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "response-link");
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const attempt = await ctx.db.get(seeded.attemptId);
            const section = await ctx.db.get(seeded.sectionAttemptId);
            if (!(attempt && section)) {
              throw new Error("Expected one attempt and section attempt.");
            }
            const { _creationTime, _id, ...attemptValues } = attempt;
            const foreignAttemptId = await ctx.db.insert(
              "tryoutAttempts",
              attemptValues
            );
            const foreignSectionId = await ctx.db.insert(
              "tryoutSectionAttempts",
              {
                answeredCount: 0,
                completedAt: null,
                correctAnswers: 0,
                endReason: null,
                expiresAt: section.expiresAt,
                lastActivityAt: section.lastActivityAt,
                sectionIdentity: section.sectionIdentity,
                sectionKey: section.sectionKey,
                sectionOrder: section.sectionOrder,
                startedAt: section.startedAt,
                status: "in-progress",
                totalQuestions: section.totalQuestions,
                tryoutAttemptId: foreignAttemptId,
              }
            );
            await ctx.db.insert("tryoutResponses", {
              answeredAt: TRYOUT_TEST_NOW,
              isCorrect: seeded.selectedChoice.isCorrect,
              placementId: seeded.placementId,
              selectedOptionId: seeded.selectedChoice.optionKey,
              timeSpent: 0,
              tryoutAttemptId: seeded.attemptId,
              tryoutSectionAttemptId: foreignSectionId,
              updatedAt: TRYOUT_TEST_NOW,
            });
          })
        );
        yield* setResponseClock(5000);

        yield* expectSaveFailure(seeded, {
          code: "TRYOUT_RESPONSE_LINK_MISMATCH",
        });
        const stored = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            attempt: await ctx.db.get(seeded.attemptId),
            response: await ctx.db
              .query("tryoutResponses")
              .withIndex("by_placementId", (index) =>
                index.eq("placementId", seeded.placementId)
              )
              .unique(),
            section: await ctx.db.get(seeded.sectionAttemptId),
          }))
        );
        expect(stored.response?.updatedAt).toBe(TRYOUT_TEST_NOW);
        expect(stored.section).toMatchObject({
          answeredCount: 0,
          correctAnswers: 0,
          lastActivityAt: TRYOUT_TEST_NOW,
        });
        expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
      })
  );

  it.effect("rejects duplicate placement responses before any overwrite", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "response-duplicate");
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          for (const offset of [0, 1]) {
            await ctx.db.insert("tryoutResponses", {
              answeredAt: TRYOUT_TEST_NOW + offset,
              isCorrect: seeded.selectedChoice.isCorrect,
              placementId: seeded.placementId,
              selectedOptionId: seeded.selectedChoice.optionKey,
              timeSpent: offset,
              tryoutAttemptId: seeded.attemptId,
              tryoutSectionAttemptId: seeded.sectionAttemptId,
              updatedAt: TRYOUT_TEST_NOW + offset,
            });
          }
        })
      );
      yield* setResponseClock(5000);

      yield* expectSaveFailure(seeded, {
        code: "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE",
      });
      const stored = yield* readResponseState(t, seeded);
      expect(stored.responses.map(({ updatedAt }) => updatedAt)).toEqual([
        TRYOUT_TEST_NOW,
        TRYOUT_TEST_NOW + 1,
      ]);
      expect(stored.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
      expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    })
  );

  it.effect("rejects stale stored correctness before any overwrite", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "response-correctness");
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("tryoutResponses", {
            answeredAt: TRYOUT_TEST_NOW,
            isCorrect: !seeded.selectedChoice.isCorrect,
            placementId: seeded.placementId,
            selectedOptionId: seeded.selectedChoice.optionKey,
            timeSpent: 0,
            tryoutAttemptId: seeded.attemptId,
            tryoutSectionAttemptId: seeded.sectionAttemptId,
            updatedAt: TRYOUT_TEST_NOW,
          })
        )
      );
      yield* setResponseClock(5000);

      yield* expectSaveFailure(seeded, {
        code: "TRYOUT_RESPONSE_SELECTION_MISMATCH",
      });
      const stored = yield* Effect.promise(() =>
        t.query(async (ctx) => ({
          attempt: await ctx.db.get(seeded.attemptId),
          response: await ctx.db.query("tryoutResponses").unique(),
          section: await ctx.db.get(seeded.sectionAttemptId),
        }))
      );
      expect(stored.response).toMatchObject({
        isCorrect: !seeded.selectedChoice.isCorrect,
        updatedAt: TRYOUT_TEST_NOW,
      });
      expect(stored.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
      expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    })
  );
});
