import { Ref } from "@confect/core";
import { assert } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import type { AttemptRefused } from "@repo/backend/confect/assessment/gate/refusal";
import type { Selection } from "@repo/backend/confect/response/model";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type Caller,
  type Change,
  Failure,
  Observed,
  type Pick,
  type Target,
} from "@repo/backend/test/gate/world";
import {
  authenticate,
  type ConvexTest,
} from "@repo/backend/test/tryout/response";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import type { FunctionReference } from "convex/server";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** When every gate case writes: five seconds into the running section. */
export const GATE_NOW = TRYOUT_TEST_NOW + 5000;
/** The key of the seeded attempt's second section, which the learner never started. */
const UNSTARTED_KEY = "penalaran-umum";

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
    NotDue: attemptNotActive,
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
    NotDue: attemptNotActive,
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

/** A true-or-false table of two statements, answered in full or in part. */
const tableSpec: Doc<"tryoutAttemptPlacements">["responseSpec"] = {
  categories: [
    { categoryKey: "true", label: "Benar", order: 1 },
    { categoryKey: "false", label: "Salah", order: 2 },
  ],
  kind: "category",
  statements: [
    {
      correctCategoryKey: "true",
      label: "Satu",
      order: 1,
      statementKey: "one",
    },
    {
      correctCategoryKey: "false",
      label: "Dua",
      order: 2,
      statementKey: "two",
    },
  ],
};

/** A text answer only the grader can decide against a key accepting "Jakarta". */
const typedSpec: Doc<"tryoutAttemptPlacements">["responseSpec"] = {
  key: {
    acceptedAnswers: ["Jakarta"],
    collapseWhitespace: true,
    ignoreCase: true,
    kind: "text",
  },
  kind: "short-answer",
  language: "id",
};

/**
 * Seeds the try-out side of the gate contract: a learner's attempt scored raw
 * with a running section and an unstarted section, one question each, another
 * learner, and IDs that name no question and no attempt.
 */
const seedRows = async (ctx: MutationCtx) => {
  const state = await seedTryoutContentAccessState(ctx, {
    attemptStatus: "in-progress",
    sectionStatus: "in-progress",
    suffix: "gate",
  });
  const other = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix: "gate-other",
  });
  const attempt = await ctx.db.get(state.attemptId);
  const placement = await ctx.db.get(state.placementId);
  assert.ok(attempt && placement, "Expected one seeded try-out attempt.");
  const snapshot = Option.getOrThrow(Arr.head(attempt.sectionSnapshots));
  const unstarted = {
    ...snapshot,
    sectionIdentity: `${snapshot.sectionIdentity}/${UNSTARTED_KEY}`,
    sectionKey: UNSTARTED_KEY,
    sectionOrder: 2,
  };
  await ctx.db.patch(attempt._id, {
    scoreStatus: "official",
    scoringStrategy: "raw",
    sectionSnapshots: [snapshot, unstarted],
    totalQuestions: 2,
  });
  const unstartedPlacementId = await ctx.db.insert("tryoutAttemptPlacements", {
    ...Struct.omit(placement, ["_creationTime", "_id"]),
    placementIdentity: `${placement.placementIdentity}/${UNSTARTED_KEY}`,
    sectionIdentity: unstarted.sectionIdentity,
    sectionKey: UNSTARTED_KEY,
  });
  assert.ok(
    placement.responseSpec.kind === "single-choice",
    "Expected one single-choice try-out question."
  );
  const options = placement.responseSpec.options;
  const correct = Arr.findFirst(options, ({ isCorrect }) => isCorrect);
  const incorrect = Arr.findFirst(options, ({ isCorrect }) => !isCorrect);
  assert.ok(
    Option.isSome(correct) && Option.isSome(incorrect),
    "Expected a correct and an incorrect frozen choice."
  );
  const missingAttemptId = await ctx.db.insert(
    "tryoutAttempts",
    Struct.omit(attempt, ["_creationTime", "_id"])
  );
  await ctx.db.delete(missingAttemptId);
  const missingPlacementId = await ctx.db.insert(
    "tryoutAttemptPlacements",
    Struct.omit(placement, ["_creationTime", "_id"])
  );
  await ctx.db.delete(missingPlacementId);
  return {
    attemptId: attempt._id,
    choices: {
      correct: correct.value.optionKey,
      incorrect: incorrect.value.optionKey,
    },
    identity: state.identity,
    missingAttemptId,
    missingPlacementId,
    other,
    placementId: placement._id,
    sectionAttemptId: state.sectionAttemptId,
    unstartedPlacementId,
  };
};

/** Calls one public mutation and reports its typed failure, decoded through the function's own contract. */
const call = <R extends Ref.AnyPublicMutation>(
  client: ReturnType<ConvexTest["withIdentity"]>,
  ref: R,
  args: Ref.Args<R>
) =>
  Ref.runWithCodec(
    ref,
    args,
    (reference: FunctionReference<"mutation">, encoded) =>
      client.mutation(reference, encoded)
  ).pipe(
    Effect.catchTag("SchemaError", Effect.die),
    Effect.match({
      onFailure: (error) =>
        Option.some(Failure.make(Struct.pick(error, ["_tag", "code"]))),
      onSuccess: () => Option.none(),
    })
  );

/** Runs one direct database change in the fixture's test deployment. */
const patch = (t: ConvexTest, change: (ctx: MutationCtx) => Promise<unknown>) =>
  Effect.promise(() => t.mutation(change)).pipe(Effect.asVoid);

/** One seeded try-out world for the gate contract. */
export const seedTryoutGate = Effect.gen(function* () {
  yield* Effect.sync(() => vi.setSystemTime(GATE_NOW));
  const t = createConvexTestWithBetterAuth();
  const seeded = yield* Effect.promise(() => t.mutation(seedRows));
  const clients = {
    learner: authenticate(t, seeded.identity),
    other: authenticate(t, seeded.other),
  };
  const placements = {
    missing: seeded.missingPlacementId,
    running: seeded.placementId,
    unstarted: seeded.unstartedPlacementId,
  };
  const sections = {
    missing: {
      attemptId: seeded.missingAttemptId,
      sectionKey: TRYOUT_SECTION_KEY,
    },
    running: { attemptId: seeded.attemptId, sectionKey: TRYOUT_SECTION_KEY },
    unstarted: { attemptId: seeded.attemptId, sectionKey: UNSTARTED_KEY },
  };
  const selections: Record<Pick, Selection | null> = {
    clear: null,
    incomplete: {
      assignments: [{ categoryKey: "true", statementKey: "one" }],
      kind: "category",
    },
    correct: { kind: "single-choice", optionKey: seeded.choices.correct },
    incorrect: { kind: "single-choice", optionKey: seeded.choices.incorrect },
    invalid: { kind: "single-choice", optionKey: "outside-the-frozen-options" },
    kind: { kind: "short-answer", text: "Jakarta" },
    pending: { kind: "short-answer", text: "Bandung" },
  };
  const changes: Record<Change, (ctx: MutationCtx) => Promise<unknown>> = {
    "close-attempt": (ctx) =>
      ctx.db.patch(seeded.attemptId, {
        completedAt: GATE_NOW,
        endReason: "submitted",
        status: "completed",
      }),
    "close-section": (ctx) =>
      ctx.db.patch(seeded.sectionAttemptId, {
        completedAt: GATE_NOW,
        endReason: "submitted",
        status: "completed",
      }),
    "duplicate-section": async (ctx) => {
      const section = await ctx.db.get(seeded.sectionAttemptId);
      assert.ok(section, "Expected the running section.");
      await ctx.db.insert(
        "tryoutSectionAttempts",
        Struct.omit(section, ["_creationTime", "_id"])
      );
    },
    "expire-attempt": async (ctx) => {
      await ctx.db.patch(seeded.attemptId, { expiresAt: GATE_NOW });
      await ctx.db.patch(seeded.sectionAttemptId, { expiresAt: GATE_NOW });
    },
    "expire-attempt-status": (ctx) =>
      ctx.db.patch(seeded.attemptId, {
        completedAt: GATE_NOW,
        endReason: "time-expired",
        status: "expired",
      }),
    "expire-section": (ctx) =>
      ctx.db.patch(seeded.sectionAttemptId, { expiresAt: GATE_NOW }),
  };
  return {
    ...seeded,
    answer: (caller: Caller, target: Target, pick: Pick, version: number) =>
      Effect.gen(function* () {
        const frozen = { incomplete: tableSpec, pending: typedSpec };
        if (pick === "incomplete" || pick === "pending") {
          yield* patch(t, (ctx) =>
            ctx.db.patch(seeded.placementId, { responseSpec: frozen[pick] })
          );
        }
        return yield* call(
          clients[caller],
          refs.public.tryouts.mutations.responses.save,
          {
            placementId: placements[target],
            selection: selections[pick],
            version,
          }
        );
      }),
    arrange: (change: Change) => patch(t, changes[change]),
    flag: (caller: Caller, target: Target, flagged: boolean) =>
      call(clients[caller], refs.public.tryouts.mutations.responses.flag, {
        flagged,
        placementId: placements[target],
      }),
    flags: Effect.promise(() =>
      t.query((ctx) => ctx.db.query("assessmentFlags").collect())
    ),
    finish: (caller: Caller, target: Target) =>
      call(
        clients[caller],
        refs.public.tryouts.mutations.sections.complete,
        sections[target]
      ),
    observe: Effect.promise(() =>
      t.query(async (ctx) => {
        const section = await ctx.db.get(seeded.sectionAttemptId);
        const placement = await ctx.db.get(seeded.placementId);
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
          outcome: Option.map(
            Option.fromNullishOr(response?.outcome),
            ({ status }) => status
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
      t.query(async (ctx) => ({
        attempts: await ctx.db.query("tryoutAttempts").collect(),
        placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
        responses: await ctx.db.query("tryoutResponses").collect(),
        scores: await ctx.db.query("tryoutScores").collect(),
        sections: await ctx.db.query("tryoutSectionAttempts").collect(),
      }))
    ),
    t,
  };
});

/** One seeded try-out gate world, with the IDs its corruptions change. */
export type TryoutGateWorld = Effect.Success<typeof seedTryoutGate>;

/** Inserts one stored answer of the running question, linked to `sectionAttemptId`. */
export function insertAnswer(
  ctx: MutationCtx,
  world: TryoutGateWorld,
  sectionAttemptId: Id<"tryoutSectionAttempts">,
  optionKey: string,
  isCorrect: boolean
) {
  return ctx.db.insert("tryoutResponses", {
    answeredAt: TRYOUT_TEST_NOW,
    isComplete: true,
    isCorrect,
    placementId: world.placementId,
    selection: { kind: "single-choice", optionKey },
    timeSpent: 0,
    tryoutAttemptId: world.attemptId,
    tryoutSectionAttemptId: sectionAttemptId,
    updatedAt: TRYOUT_TEST_NOW,
  });
}
