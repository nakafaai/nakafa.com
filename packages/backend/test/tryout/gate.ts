import type { Ref } from "@confect/core";
import { assert } from "@effect/vitest";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { AttemptRefused } from "@repo/backend/confect/assessment/gate/refusal";
import type { Grade } from "@repo/backend/confect/assessment/grade";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import { encodePlacedQuestion } from "@repo/backend/confect/tryouts/runtime/question";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { client } from "@repo/backend/test/client";
import {
  type Caller,
  type Change,
  Failure,
  Observed,
  type Pick,
  type Target,
} from "@repo/backend/test/gate/world";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Option, Schema, Struct } from "effect";

/** When every gate case writes: five seconds into the running section. */
export const GATE_NOW = TRYOUT_NOW + 5000;
/** The running section of the seeded attempt, and the one the learner never started. */
const RUNNING_KEY = "section-a";
const UNSTARTED_KEY = "section-b";

const attemptNotActive = Failure.make({
  _tag: "TryoutAttemptStateError",
  code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
});
const sectionNotActive = Failure.make({
  _tag: "TryoutAttemptStateError",
  code: "TRYOUT_SECTION_NOT_ACTIVE",
});

/**
 * The error each try-out function declares for each refusal, by write. A try-out never
 * produces the window, place, or device refusals, which map as production maps them, so
 * each map stays total.
 */
export const tryoutRefusals = {
  answer: {
    AttemptClosed: attemptNotActive,
    Closed: attemptNotActive,
    DeviceRetired: attemptNotActive,
    Expired: Failure.make({
      _tag: "TryoutResponseError",
      code: "TRYOUT_EXPIRED",
    }),
    Locked: attemptNotActive,
    Missing: Failure.make({
      _tag: "TryoutResponseError",
      code: "TRYOUT_PLACEMENT_NOT_FOUND",
    }),
    NotOpen: attemptNotActive,
    OtherDevice: attemptNotActive,
    PlaceLocked: attemptNotActive,
    SectionClosed: sectionNotActive,
  },
  finish: {
    AttemptClosed: attemptNotActive,
    Closed: attemptNotActive,
    DeviceRetired: attemptNotActive,
    Expired: attemptNotActive,
    Locked: attemptNotActive,
    Missing: Failure.make({
      _tag: "TryoutAttemptStateError",
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
    }),
    NotOpen: attemptNotActive,
    OtherDevice: attemptNotActive,
    PlaceLocked: attemptNotActive,
    SectionClosed: sectionNotActive,
  },
} satisfies Record<
  "answer" | "finish",
  Record<AttemptRefused["reason"]["_tag"], Failure>
>;

/** The error the answer function declares for a version that is not newer than the question's latest write. */
export const tryoutStale = Failure.make({
  _tag: "TryoutResponseError",
  code: "TRYOUT_RESPONSE_STALE",
});

/** A typed answer only a grader decides: a text entry whose key accepts "Jakarta", as a place stores it. */
const typed = Effect.all({
  interaction: Schema.decodeEffect(InteractionSchema)({
    id: "typed",
    kind: "textEntry",
    label: "Jawaban",
  }),
  key: Schema.decodeEffect(InteractionKeySchema)({
    accepted: {
      acceptedAnswers: ["Jakarta"],
      collapseWhitespace: true,
      ignoreCase: true,
      kind: "text",
    },
    interaction: "typed",
    kind: "textEntry",
  }),
}).pipe(Effect.flatMap(encodePlacedQuestion), Effect.orDie);

/** The grade of the running question's key under its all-or-nothing rule, or of a wrong choice. */
export const choiceGrade = (correct: boolean): Grade => ({
  category: correct ? 1 : 0,
  ceiling: 1,
  status: "scored",
});

/** The outcome a stored grade shows: correct, incorrect, partial, or waiting for a grader. */
function outcomeOf(grade: Grade) {
  if (grade.status === "pending") {
    return "pending" as const;
  }
  if (grade.category === grade.ceiling) {
    return "correct" as const;
  }
  return grade.category === 0 ? ("incorrect" as const) : ("partial" as const);
}

/** Calls one public mutation and reports its typed failure, decoded through the function's own contract. */
const call = <R extends Ref.AnyPublicMutation>(
  caller: ReturnType<typeof client>,
  ref: R,
  args: Ref.Args<R>
) =>
  caller.mutation(ref, args).pipe(
    Effect.catchTag("SchemaError", Effect.die),
    Effect.match({
      onFailure: (error) =>
        Option.some(Failure.make(Struct.pick(error, ["_tag", "code"]))),
      onSuccess: () => Option.none(),
    })
  );

/**
 * One seeded try-out world for the gate contract: a learner's raw attempt of the fixture set with
 * its first section running and its second unstarted, another learner, and IDs that name no question
 * and no attempt. The running question is a single choice whose key is option 2.
 */
export const seedTryoutGate = Effect.gen(function* () {
  const world = yield* tryoutWorld({ suffix: "gate" });
  const { attemptId } = yield* world.start();
  yield* world.learner.mutation(tryouts.mutations.sections.start, {
    attemptId,
    sectionKey: RUNNING_KEY,
  });
  const seeded = yield* Effect.promise(() =>
    world.t.mutation(async (ctx) => {
      const other = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_NOW,
        suffix: "gate-other",
      });
      const attempt = await ctx.db.get("tryoutAttempts", attemptId);
      const placements = await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex(
          "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
          (query) => query.eq("tryoutAttemptId", attemptId)
        )
        .collect();
      const section = await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionKey", (query) =>
          query.eq("tryoutAttemptId", attemptId).eq("sectionKey", RUNNING_KEY)
        )
        .unique();
      const [running, , unstarted] = placements;
      assert.ok(
        attempt && section && running && unstarted,
        "Expected the seeded attempt, its running section, and its questions."
      );
      const missingAttemptId = await ctx.db.insert(
        "tryoutAttempts",
        Struct.omit(attempt, ["_creationTime", "_id"])
      );
      await ctx.db.delete("tryoutAttempts", missingAttemptId);
      const missingPlacementId = await ctx.db.insert(
        "tryoutAttemptPlacements",
        Struct.omit(running, ["_creationTime", "_id"])
      );
      await ctx.db.delete("tryoutAttemptPlacements", missingPlacementId);
      return {
        missingAttemptId,
        missingPlacementId,
        other,
        placementId: running._id,
        sectionAttemptId: section._id,
        table: Struct.pick(unstarted, ["interactionJson", "keyJson"]),
        unstartedPlacementId: unstarted._id,
      };
    })
  );
  yield* Effect.sync(() => vi.setSystemTime(GATE_NOW));
  const clients = {
    learner: world.learner,
    other: client(
      world.t.withIdentity({
        sessionId: seeded.other.sessionId,
        subject: seeded.other.authUserId,
      })
    ),
  };
  const placements = {
    missing: seeded.missingPlacementId,
    running: seeded.placementId,
    unstarted: seeded.unstartedPlacementId,
  };
  const sections = {
    missing: { attemptId: seeded.missingAttemptId, sectionKey: RUNNING_KEY },
    running: { attemptId, sectionKey: RUNNING_KEY },
    unstarted: { attemptId, sectionKey: UNSTARTED_KEY },
  };
  const responses: Record<Pick, ExamResponse | null> = {
    clear: null,
    correct: ["option-2"],
    incomplete: { cells: [{ column: "column-1", statement: "statement-1" }] },
    incorrect: ["option-1"],
    invalid: ["outside-the-frozen-options"],
    kind: { text: "Jakarta" },
    pending: { text: "Bandung" },
  };
  /** The question a pick answers: a table for a partial answer, a typed answer for a grader's. */
  const frozen: Partial<Record<Pick, typeof seeded.table>> = {
    incomplete: seeded.table,
    pending: yield* typed,
  };
  const patch = (change: (ctx: MutationCtx) => Promise<unknown>) =>
    Effect.promise(() => world.t.mutation(change)).pipe(Effect.asVoid);
  const changes: Record<Change, (ctx: MutationCtx) => Promise<unknown>> = {
    "close-attempt": (ctx) =>
      ctx.db.patch("tryoutAttempts", attemptId, {
        completedAt: GATE_NOW,
        endReason: "submitted",
        status: "completed",
      }),
    "close-section": (ctx) =>
      ctx.db.patch("tryoutSectionAttempts", seeded.sectionAttemptId, {
        completedAt: GATE_NOW,
        endReason: "submitted",
        status: "completed",
      }),
    "duplicate-section": async (ctx) => {
      const section = await ctx.db.get(
        "tryoutSectionAttempts",
        seeded.sectionAttemptId
      );
      assert.ok(section, "Expected the running section.");
      await ctx.db.insert(
        "tryoutSectionAttempts",
        Struct.omit(section, ["_creationTime", "_id"])
      );
    },
    "expire-attempt": async (ctx) => {
      await ctx.db.patch("tryoutAttempts", attemptId, { expiresAt: GATE_NOW });
      await ctx.db.patch("tryoutSectionAttempts", seeded.sectionAttemptId, {
        expiresAt: GATE_NOW,
      });
    },
    "expire-attempt-status": (ctx) =>
      ctx.db.patch("tryoutAttempts", attemptId, {
        completedAt: GATE_NOW,
        endReason: "time-expired",
        status: "expired",
      }),
    "expire-section": (ctx) =>
      ctx.db.patch("tryoutSectionAttempts", seeded.sectionAttemptId, {
        expiresAt: GATE_NOW,
      }),
  };
  return {
    ...seeded,
    answer: (caller: Caller, target: Target, pick: Pick, version: number) =>
      Effect.gen(function* () {
        const question = frozen[pick];
        if (question) {
          yield* patch((ctx) =>
            ctx.db.patch(
              "tryoutAttemptPlacements",
              seeded.placementId,
              question
            )
          );
        }
        return yield* call(clients[caller], tryouts.mutations.responses.save, {
          placementId: placements[target],
          response: responses[pick],
          version,
        });
      }),
    arrange: (change: Change) => patch(changes[change]),
    attemptId,
    flag: (caller: Caller, target: Target, flagged: boolean) =>
      call(clients[caller], tryouts.mutations.responses.flag, {
        flagged,
        placementId: placements[target],
      }),
    flags: Effect.promise(() =>
      world.t.query((ctx) => ctx.db.query("assessmentFlags").collect())
    ),
    finish: (caller: Caller, target: Target) =>
      call(
        clients[caller],
        tryouts.mutations.sections.complete,
        sections[target]
      ),
    observe: Effect.promise(() =>
      world.t.query(async (ctx) => {
        const section = await ctx.db.get(
          "tryoutSectionAttempts",
          seeded.sectionAttemptId
        );
        const placement = await ctx.db.get(
          "tryoutAttemptPlacements",
          seeded.placementId
        );
        const response = await ctx.db
          .query("tryoutResponses")
          .withIndex("by_placementId", (query) =>
            query.eq("placementId", seeded.placementId)
          )
          .first();
        assert.ok(
          section && placement,
          "Expected the running section and its question."
        );
        return Observed.make({
          answered: section.answeredCount,
          correct: section.correctAnswers,
          outcome: Option.map(Option.fromNullOr(response), ({ grade }) =>
            outcomeOf(grade)
          ),
          section:
            section.status === "in-progress"
              ? "running"
              : Option.getOrThrow(Option.fromNullOr(section.endReason)),
          version: Option.fromNullishOr(
            response?.version ?? placement.clearedVersion
          ),
        });
      })
    ),
    rows: Effect.promise(() =>
      world.t.query(async (ctx) => ({
        attempts: await ctx.db.query("tryoutAttempts").collect(),
        placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
        responses: await ctx.db.query("tryoutResponses").collect(),
        scores: await ctx.db.query("tryoutScores").collect(),
        sections: await ctx.db.query("tryoutSectionAttempts").collect(),
      }))
    ),
    learner: world.learner,
    learnerConvex: world.learnerConvex,
    run: world.run,
    t: world.t,
    userId: world.userId,
  };
}).pipe(
  // A seed that fails is a broken fixture, not a case under test.
  Effect.orDie
);

/** One seeded try-out gate world, with the IDs its corruptions change. */
export type TryoutGateWorld = Effect.Success<typeof seedTryoutGate>;

/** Inserts one stored answer of the running question, linked to `sectionAttemptId`. */
export function insertAnswer(
  ctx: MutationCtx,
  world: TryoutGateWorld,
  sectionAttemptId: Id<"tryoutSectionAttempts">,
  response: Doc<"tryoutResponses">["response"],
  grade: Grade
) {
  return ctx.db.insert("tryoutResponses", {
    answeredAt: TRYOUT_NOW,
    grade,
    placementId: world.placementId,
    response,
    timeSpent: 0,
    tryoutAttemptId: world.attemptId,
    tryoutSectionAttemptId: sectionAttemptId,
    updatedAt: TRYOUT_NOW,
    version: 1,
  });
}
