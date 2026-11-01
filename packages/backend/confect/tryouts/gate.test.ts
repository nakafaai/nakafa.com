import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { tryoutGate } from "@repo/backend/confect/tryouts/gate";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { client, inMutation } from "@repo/backend/test/client";
import { describeGate } from "@repo/backend/test/gate";
import { Failure } from "@repo/backend/test/gate/world";
import {
  choiceGrade,
  GATE_NOW,
  insertAnswer,
  seedTryoutGate,
  type TryoutGateWorld,
  tryoutRefusals,
  tryoutStale,
} from "@repo/backend/test/tryout/gate";
import { TRYOUT_NOW } from "@repo/backend/test/tryout/world";
import { Effect, Option, Struct } from "effect";

const integrity = (code: string) =>
  Failure.make({ _tag: "TryoutResponseIntegrityError", code });

/** Runs one direct database change in a seeded world. */
const change = (
  world: TryoutGateWorld,
  edit: (ctx: MutationCtx) => Promise<unknown>
) => Effect.promise(() => world.t.mutation(edit)).pipe(Effect.asVoid);

/** Reads the running question's stored answer and its section and attempt rows. */
const stored = (world: TryoutGateWorld) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      attempt: await ctx.db.get("tryoutAttempts", world.attemptId),
      responses: await ctx.db.query("tryoutResponses").collect(),
      section: await ctx.db.get(
        "tryoutSectionAttempts",
        world.sectionAttemptId
      ),
    }))
  );

const misnumberSection = (world: TryoutGateWorld) =>
  change(world, (ctx) =>
    ctx.db.patch("tryoutSectionAttempts", world.sectionAttemptId, {
      sectionOrder: 999,
    })
  );

/** Moves the clock to `ms` after the world's start. */
const setClock = (ms: number) =>
  Effect.sync(() => vi.setSystemTime(TRYOUT_NOW + ms));

describeGate("tryouts", {
  corruptions: [
    {
      arrange: misnumberSection,
      failure: integrity("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"),
      name: "an answer to a section that contradicts its frozen section",
      write: "answer",
    },
    {
      arrange: misnumberSection,
      failure: integrity("TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH"),
      name: "a finish of a section that contradicts its frozen section",
      write: "finish",
    },
    {
      arrange: (world) =>
        change(world, async (ctx) => {
          const attempt = await ctx.db.get("tryoutAttempts", world.attemptId);
          const section = await ctx.db.get(
            "tryoutSectionAttempts",
            world.sectionAttemptId
          );
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
            ["option-2"],
            choiceGrade(true)
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
            ["option-2"],
            choiceGrade(true)
          );
          await insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            ["option-2"],
            choiceGrade(true)
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
            ["option-2"],
            choiceGrade(false)
          )
        ),
      failure: integrity("TRYOUT_RESPONSE_GRADE_MISMATCH"),
      name: "a stored grade its response does not reproduce",
      write: "answer",
    },
    {
      arrange: (world) =>
        change(world, (ctx) =>
          insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            { text: "Jakarta" },
            choiceGrade(true)
          )
        ),
      failure: integrity("TRYOUT_RESPONSE_GRADE_MISMATCH"),
      name: "a stored response that no longer fits its question",
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
  rejection: Failure.make({
    _tag: "TryoutResponseUnfitError",
    code: "TRYOUT_RESPONSE_UNFIT",
  }),
  seed: seedTryoutGate,
  stale: tryoutStale,
});

describe("tryouts/gate", () => {
  it.effect(
    "flags and unflags a running question in the shared flags table, and a repeat changes nothing",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        expect(yield* world.flag("learner", "running", true)).toEqual(
          Option.none()
        );
        expect(yield* world.flag("learner", "running", true)).toEqual(
          Option.none()
        );
        expect(yield* world.flags).toMatchObject([
          {
            attempt: world.attemptId,
            kind: "tryout",
            question: world.placementId,
          },
        ]);
        expect(yield* world.flag("learner", "running", false)).toEqual(
          Option.none()
        );
        expect(yield* world.flag("learner", "running", false)).toEqual(
          Option.none()
        );
        expect(yield* world.flags).toEqual([]);
      })
  );

  it.effect(
    "refuses a flag once the section's deadline passed, and another learner's flag as a missing question",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        expect(yield* world.flag("other", "running", true)).toEqual(
          Option.some(tryoutRefusals.answer.Missing)
        );
        yield* world.arrange("expire-section");
        expect(yield* world.flag("learner", "running", true)).toEqual(
          Option.some(tryoutRefusals.answer.Expired)
        );
        expect(yield* world.flags).toEqual([]);
      })
  );

  it.effect(
    "keeps the first answer time and counts seconds spent in the section",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* world.answer("learner", "running", "correct", 1);
        yield* setClock(9000);
        const before = yield* stored(world);
        yield* world.answer("learner", "running", "correct", 2);
        const rows = yield* stored(world);
        expect(rows.responses).toMatchObject([
          {
            answeredAt: GATE_NOW,
            grade: choiceGrade(true),
            response: ["option-2"],
            timeSpent: 9,
            updatedAt: TRYOUT_NOW + 9000,
            version: 2,
          },
        ]);
        expect(rows.section?.lastActivityAt).toBe(TRYOUT_NOW + 9000);
        // Every query of the attempt reads its row, so an answer leaves it alone.
        expect(rows.attempt).toEqual(before.attempt);
      })
  );

  it.effect(
    "accepts the last instant before the deadline and refuses the deadline without overwriting",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* setClock(599_999);
        yield* world.answer("learner", "running", "correct", 1);
        yield* setClock(600_000);
        expect(
          yield* world.answer("learner", "running", "incorrect", 2)
        ).toEqual(Option.some(tryoutRefusals.answer.Expired));
        expect((yield* stored(world)).responses).toMatchObject([
          {
            answeredAt: TRYOUT_NOW + 599_999,
            timeSpent: 599,
            updatedAt: TRYOUT_NOW + 599_999,
            version: 1,
          },
        ]);
      })
  );

  it.effect(
    "refuses an answer past its deadline before it checks the question's stored answers",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        yield* change(world, (ctx) =>
          insertAnswer(
            ctx,
            world,
            world.sectionAttemptId,
            ["option-2"],
            choiceGrade(false)
          )
        );
        yield* world.arrange("expire-section");
        const before = yield* world.rows;
        expect(yield* world.answer("learner", "running", "correct", 1)).toEqual(
          Option.some(tryoutRefusals.answer.Expired)
        );
        expect(yield* world.rows).toEqual(before);
      })
  );

  it.effect(
    "records a clear on the question without changing anything else it froze",
    () =>
      Effect.gen(function* () {
        const world = yield* seedTryoutGate;
        const placement = () =>
          Effect.promise(() =>
            world.t.query((ctx) =>
              ctx.db.get("tryoutAttemptPlacements", world.placementId)
            )
          );
        const before = yield* placement();
        yield* world.answer("learner", "running", "correct", 1);
        expect(yield* placement()).toEqual(before);
        yield* world.answer("learner", "running", "clear", 2);
        expect(yield* placement()).toEqual({ ...before, clearedVersion: 2 });
      })
  );

  it.effect("masks an unexpected attempt lookup failure", () =>
    Effect.gen(function* () {
      const world = yield* seedTryoutGate;
      yield* Effect.promise(() =>
        expect(
          world.t.mutation(async (ctx) => {
            const placement = await ctx.db.get(
              "tryoutAttemptPlacements",
              world.placementId
            );
            if (!placement) {
              throw new Error("Expected one frozen placement.");
            }
            const get = vi.spyOn(ctx.db, "get");
            get.mockResolvedValueOnce(placement);
            get.mockRejectedValueOnce(
              new Error("internal tryoutAttempts storage details")
            );
            return await inMutation(() =>
              tryoutGate.answer(world.userId, {
                placementId: world.placementId,
                response: ["option-2"],
                version: 1,
              })
            )(ctx);
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
        const world = yield* seedTryoutGate;
        /** Saves the key, or clears it, at `version` and gives the reads and writes of its transaction. */
        const measure = (version: number, answered: boolean) =>
          Effect.promise(() =>
            world.t.mutation(async (ctx) => {
              await inMutation(() =>
                tryoutGate.answer(world.userId, {
                  placementId: world.placementId,
                  response: answered ? ["option-2"] : null,
                  version,
                })
              )(ctx);
              return await ctx.meta.getTransactionMetrics();
            })
          );
        yield* setClock(5000);
        const inserted = yield* measure(1, true);
        yield* setClock(9000);
        const replaced = yield* measure(2, true);
        expect((yield* stored(world)).responses).toMatchObject([
          { version: 2 },
        ]);
        const cleared = yield* measure(3, false);
        // A write reads the question, its attempt, and its section, and the
        // stored answer once there is one. It replaces the section row it
        // loaded, and the answer too once there is one. Convex reads a replaced
        // document once more. A clear deletes the answer and replaces the
        // question, which keeps the version, instead of the answer.
        expect(inserted.documentsRead.used).toBe(4);
        expect(inserted.documentsWritten.used).toBe(2);
        expect(replaced.documentsRead.used).toBe(6);
        expect(replaced.documentsWritten.used).toBe(2);
        expect(cleared.documentsRead.used).toBe(7);
        expect(cleared.documentsWritten.used).toBe(3);
      })
  );

  it.effect("refuses callers without a session before the gate", () =>
    Effect.gen(function* () {
      const world = yield* seedTryoutGate;
      const before = yield* world.rows;
      const visitor = client(world.t);
      const refused = [
        yield* visitor
          .mutation(tryouts.mutations.responses.save, {
            placementId: world.placementId,
            response: null,
            version: 1,
          })
          .pipe(Effect.flip),
        yield* visitor
          .mutation(tryouts.mutations.sections.complete, {
            attemptId: world.attemptId,
            sectionKey: "section-a",
          })
          .pipe(Effect.flip),
      ];
      expect(refused).toMatchObject([
        { code: "UNAUTHENTICATED" },
        { code: "UNAUTHENTICATED" },
      ]);
      expect(yield* world.rows).toEqual(before);
    })
  );
});
