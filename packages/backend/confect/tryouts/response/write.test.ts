import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { saveTryoutResponse } from "@repo/backend/confect/tryouts/response/write";
import { api } from "@repo/backend/convex/_generated/api";
import {
  authenticate,
  type ConvexTest,
  type ExpectedConvexFailure,
  expectConvexFailure,
  type ResponseFixture,
  readResponseState,
  seedResponseFixture,
  setResponseClock,
} from "@repo/backend/test/tryout/response";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

const saveSelection = Effect.fn("test.tryout.response.saveSelection")(
  (
    fixture: ResponseFixture,
    optionKey = fixture.selectedChoice.optionKey,
    client = fixture.client
  ) =>
    Effect.promise(() =>
      client.mutation(api.tryouts.mutations.responses.save, {
        placementId: fixture.placementId,
        selection: {
          kind: "single-choice",
          optionKey,
        },
      })
    )
);
const collectResponses = Effect.fn("test.tryout.response.collect")(
  (t: ConvexTest) =>
    Effect.promise(() =>
      t.query((ctx) => ctx.db.query("tryoutResponses").collect())
    )
);
const expectSaveFailure = Effect.fn("test.tryout.response.expectSaveFailure")(
  function* (
    fixture: ResponseFixture,
    expected: ExpectedConvexFailure,
    optionKey = fixture.selectedChoice.optionKey,
    client = fixture.client
  ) {
    yield* expectConvexFailure(
      () =>
        client.mutation(api.tryouts.mutations.responses.save, {
          placementId: fixture.placementId,
          selection: {
            kind: "single-choice",
            optionKey,
          },
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
          outcome: {
            status: seeded.selectedChoice.isCorrect ? "correct" : "incorrect",
          },
          selection: {
            kind: "single-choice",
            optionKey: seeded.selectedChoice.optionKey,
          },
          timeSpent: 9,
          updatedAt: TRYOUT_TEST_NOW + 9000,
        });
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
        for (const optionKey of ["", "option-999"]) {
          yield* expectSaveFailure(
            seeded,
            {
              code: "TRYOUT_RESPONSE_SELECTION_INVALID",
            },
            optionKey
          );
        }
        const stored = yield* readResponseState(t, seeded);
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
        yield* expectSaveFailure(seeded, {
          code: "TRYOUT_EXPIRED",
        });
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
        {
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
        },
        undefined,
        authenticate(t, outsider)
      );
      const responses = yield* collectResponses(t);
      expect(responses).toEqual([]);
    })
  );
  it.effect("masks an unexpected attempt lookup failure", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "response-storage-failure");
      yield* Effect.promise(() =>
        expect(
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
            return await Effect.runPromiseWith(runtimeServices)(
              saveTryoutResponse({
                args: {
                  placementId: seeded.placementId,
                  selection: {
                    kind: "single-choice",
                    optionKey: seeded.selectedChoice.optionKey,
                  },
                },
                now: TRYOUT_TEST_NOW + 5000,
                userId: seeded.identity.userId,
              }).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            );
          })
        ).rejects.toMatchObject({
          code: "TRYOUT_RESPONSE_FAILED",
          message: "Unable to save try-out response.",
        })
      );
    })
  );
  it.effect.each([
    {
      expectedCode: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      status: {
        attempt: "completed" as const,
      },
      suffix: "inactive-attempt",
    },
    {
      expectedCode: "TRYOUT_SECTION_NOT_ACTIVE",
      status: {
        section: "completed" as const,
      },
      suffix: "inactive-section",
    },
  ])(
    "rejects $suffix before writing a response",
    ({ expectedCode, status, suffix }) =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, suffix, status);
        yield* expectSaveFailure(seeded, {
          code: expectedCode,
        });
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
            return ctx.db.patch(seeded.sectionAttemptId, {
              sectionOrder: 999,
            });
          })
        );
        yield* expectSaveFailure(seeded, {
          code: expectedCode,
        });
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
            const {
              _id: sectionId,
              _creationTime: sectionTime,
              ...sectionValues
            } = section;
            const foreignSectionId = await ctx.db.insert(
              "tryoutSectionAttempts",
              {
                ...sectionValues,
                tryoutAttemptId: foreignAttemptId,
              }
            );
            await ctx.db.insert("tryoutResponses", {
              answeredAt: TRYOUT_TEST_NOW,
              isComplete: true,
              isCorrect: seeded.selectedChoice.isCorrect,
              placementId: seeded.placementId,
              selection: {
                kind: "single-choice",
                optionKey: seeded.selectedChoice.optionKey,
              },
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
        const stored = yield* readResponseState(t, seeded);
        expect(stored.responses[0]?.updatedAt).toBe(TRYOUT_TEST_NOW);
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
              isComplete: true,
              isCorrect: seeded.selectedChoice.isCorrect,
              placementId: seeded.placementId,
              selection: {
                kind: "single-choice",
                optionKey: seeded.selectedChoice.optionKey,
              },
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
            isComplete: true,
            isCorrect: !seeded.selectedChoice.isCorrect,
            placementId: seeded.placementId,
            selection: {
              kind: "single-choice",
              optionKey: seeded.selectedChoice.optionKey,
            },
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
      const stored = yield* readResponseState(t, seeded);
      expect(stored.responses[0]).toMatchObject({
        isCorrect: !seeded.selectedChoice.isCorrect,
        updatedAt: TRYOUT_TEST_NOW,
      });
      expect(stored.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
      expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    })
  );
  it.effect(
    "clears an unanswered or incorrect response idempotently without changing counters",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "clear-response");
        yield* setResponseClock(5000);
        const clear = () =>
          seeded.client.mutation(api.tryouts.mutations.responses.save, {
            placementId: seeded.placementId,
            selection: null,
          });
        yield* Effect.promise(clear);
        yield* saveSelection(seeded, "option-2");
        yield* Effect.promise(clear);
        yield* Effect.promise(clear);
        const stored = yield* readResponseState(t, seeded);
        expect(stored.responses).toEqual([]);
        expect(stored.section).toMatchObject({
          answeredCount: 0,
          correctAnswers: 0,
        });
        yield* Effect.promise(() =>
          t.mutation((ctx) => ctx.db.delete(seeded.placementId))
        );
        yield* expectSaveFailure(seeded, {
          code: "TRYOUT_PLACEMENT_NOT_FOUND",
        });
      })
  );
});
