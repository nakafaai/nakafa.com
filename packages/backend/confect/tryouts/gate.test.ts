import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { tryoutGate } from "@repo/backend/confect/tryouts/gate";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { describeGate } from "@repo/backend/test/gate";
import { Failure } from "@repo/backend/test/gate/world";
import {
  GATE_NOW,
  insertAnswer,
  seedTryoutGate,
  type TryoutGateWorld,
  tryoutRefusals,
  tryoutStale,
} from "@repo/backend/test/tryout/gate";
import {
  readResponseState,
  seedResponseFixture,
  setResponseClock,
} from "@repo/backend/test/tryout/response";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect, Option, Struct } from "effect";

const integrity = (code: string) =>
  Failure.make({ _tag: "TryoutResponseIntegrityError", code });

/** Runs one direct database change in a seeded world. */
const change = (
  world: TryoutGateWorld,
  edit: (ctx: MutationCtx) => Promise<unknown>
) => Effect.promise(() => world.t.mutation(edit)).pipe(Effect.asVoid);

/** Reads the running question's stored answer and its section row. */
const stored = (world: TryoutGateWorld) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      attempt: await ctx.db.get(world.attemptId),
      responses: await ctx.db.query("tryoutResponses").collect(),
      section: await ctx.db.get(world.sectionAttemptId),
    }))
  );

const misnumberSection = (world: TryoutGateWorld) =>
  change(world, (ctx) =>
    ctx.db.patch(world.sectionAttemptId, { sectionOrder: 999 })
  );

describeGate("tryouts", {
  corruptions: [
    {
      arrange: misnumberSection,
      failure: integrity("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"),
      name: "an answer to a section that contradicts its frozen snapshot",
      write: "answer",
    },
    {
      arrange: misnumberSection,
      failure: integrity("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"),
      name: "a finish of a section that contradicts its frozen snapshot",
      write: "finish",
    },
    {
      arrange: (world) =>
        change(world, (ctx) =>
          ctx.db.patch(world.placementId, {
            sectionIdentity: "another-section",
          })
        ),
      failure: integrity("TRYOUT_RESPONSE_LINK_MISMATCH"),
      name: "a question linked to another section",
      write: "answer",
    },
    {
      arrange: (world) =>
        change(world, async (ctx) => {
          const attempt = await ctx.db.get(world.attemptId);
          const section = await ctx.db.get(world.sectionAttemptId);
          if (!(attempt && section)) {
            throw new Error("Expected the seeded attempt and section.");
          }
          const foreignAttemptId = await ctx.db.insert(
            "tryoutAttempts",
            Struct.omit(attempt, ["_creationTime", "_id"])
          );
          const foreignSectionId = await ctx.db.insert(
            "tryoutSectionAttempts",
            {
              ...Struct.omit(section, ["_creationTime", "_id"]),
              tryoutAttemptId: foreignAttemptId,
            }
          );
          await insertAnswer(
            ctx,
            world,
            foreignSectionId,
            world.choices.correct,
            true
          );
        }),
      failure: integrity("TRYOUT_RESPONSE_LINK_MISMATCH"),
      name: "a stored answer linked to another attempt's section",
      write: "answer",
    },
    {
      arrange: (world) =>
        change(world, async (ctx) => {
          await insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            world.choices.correct,
            true
          );
          await insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            world.choices.correct,
            true
          );
        }),
      failure: integrity("TRYOUT_RESPONSE_PLACEMENT_DUPLICATE"),
      name: "two stored answers of one question",
      write: "answer",
    },
    {
      arrange: (world) =>
        change(world, (ctx) =>
          insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            world.choices.correct,
            false
          )
        ),
      failure: integrity("TRYOUT_RESPONSE_SELECTION_MISMATCH"),
      name: "a stored outcome its selection does not reproduce",
      write: "answer",
    },
  ],
  masked: (write) =>
    ({
      answer: Failure.make({
        _tag: "TryoutResponseError",
        code: "TRYOUT_RESPONSE_FAILED",
      }),
      finish: Failure.make({
        _tag: "TryoutRuntimeError",
        code: "TRYOUT_RUNTIME_FAILED",
      }),
    })[write],
  refusal: (write, reason) => tryoutRefusals[write][reason],
  rejection: (reason) =>
    Failure.make({
      _tag: "TryoutResponseSelectionError",
      code:
        reason === "kind"
          ? "TRYOUT_RESPONSE_KIND_MISMATCH"
          : "TRYOUT_RESPONSE_SELECTION_INVALID",
    }),
  seed: seedTryoutGate,
  stale: tryoutStale,
});

describe("tryouts/gate", () => {
  it.effect(
    "keeps the first answer time and counts seconds spent in the section",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* world.answer("learner", "running", "correct", 1);
        yield* setResponseClock(9000);
        yield* world.answer("learner", "running", "correct", 2);
        const rows = yield* stored(world);
        expect(rows.responses).toMatchObject([
          {
            answeredAt: GATE_NOW,
            outcome: { status: "correct" },
            timeSpent: 9,
            updatedAt: TRYOUT_TEST_NOW + 9000,
            version: 2,
          },
        ]);
        expect(rows.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW + 9000);
        expect(rows.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW + 9000);
      })
  );
  it.effect(
    "accepts the last instant before the deadline and refuses the deadline without overwriting",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* setResponseClock(1_799_999);
        yield* world.answer("learner", "running", "correct", 1);
        yield* setResponseClock(1_800_000);
        expect(
          yield* world.answer("learner", "running", "incorrect", 2)
        ).toEqual(Option.some(tryoutRefusals.answer.Expired));
        expect((yield* stored(world)).responses).toMatchObject([
          {
            answeredAt: TRYOUT_TEST_NOW + 1_799_999,
            timeSpent: 1799,
            updatedAt: TRYOUT_TEST_NOW + 1_799_999,
            version: 1,
          },
        ]);
      })
  );
  it.effect(
    "reads an answer stored before outcomes and versions from its correctness flag",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* change(world, async (ctx) => {
          await insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            world.choices.correct,
            true
          );
          await ctx.db.patch(world.sectionAttemptId, {
            answeredCount: 1,
            correctAnswers: 1,
          });
        });
        yield* world.answer("learner", "running", "incorrect", 1);
        expect(yield* world.observe).toEqual({
          answered: 1,
          correct: 0,
          outcome: Option.some("incorrect"),
          section: "running",
          version: Option.some(1),
        });
      })
  );
  it.effect("masks an unexpected attempt lookup failure", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* seedResponseFixture(t, "gate-storage-failure");
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
              tryoutGate
                .answer(seeded.identity.userId, {
                  placementId: seeded.placementId,
                  selection: {
                    kind: "single-choice",
                    optionKey: seeded.selectedChoice.optionKey,
                  },
                  version: 1,
                })
                .pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            );
          })
        ).rejects.toMatchObject({
          code: "TRYOUT_RESPONSE_FAILED",
          message: "Unable to save try-out response.",
        })
      );
    })
  );
  it.effect(
    "replaces the rows it loaded, so no row is read again by a partial update",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* seedResponseFixture(t, "gate-metrics");
        /** Saves the question's first choice at `version` and gives the reads and writes of its transaction. */
        const measure = (version: number) =>
          Effect.promise(() =>
            t.mutation(async (ctx) => {
              await Effect.runPromiseWith(runtimeServices)(
                tryoutGate
                  .answer(seeded.identity.userId, {
                    placementId: seeded.placementId,
                    selection: {
                      kind: "single-choice",
                      optionKey: seeded.selectedChoice.optionKey,
                    },
                    version,
                  })
                  .pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
              );
              return await ctx.meta.getTransactionMetrics();
            })
          );
        yield* setResponseClock(5000);
        const inserted = yield* measure(1);
        yield* setResponseClock(9000);
        const replaced = yield* measure(2);
        // A write reads the question, its attempt, and its section, and the
        // stored answer once there is one. It replaces the section and attempt
        // rows it loaded, and the answer too once there is one. Convex reads a
        // replaced document once more.
        expect(inserted.documentsRead.used).toBe(5);
        expect(inserted.documentsWritten.used).toBe(3);
        expect(replaced.documentsRead.used).toBe(7);
        expect(replaced.documentsWritten.used).toBe(3);
        expect((yield* readResponseState(t, seeded)).responses).toMatchObject([
          { version: 2 },
        ]);
      })
  );
  it.effect("refuses callers without a session before the gate", () =>
    Effect.gen(function* () {
      const world = yield* seedTryoutGate;
      const before = yield* world.rows;
      for (const call of [
        () =>
          world.t.mutation(api.tryouts.mutations.responses.save, {
            placementId: world.placementId,
            selection: null,
            version: 1,
          }),
        () =>
          world.t.mutation(api.tryouts.mutations.sections.complete, {
            attemptId: world.attemptId,
            sectionKey: "penalaran-matematika",
          }),
      ]) {
        const failure = yield* Effect.tryPromise(call).pipe(Effect.flip);
        expect(failure.cause).toMatchObject({
          data: { code: "UNAUTHENTICATED" },
        });
      }
      expect(yield* world.rows).toEqual(before);
    })
  );
});
