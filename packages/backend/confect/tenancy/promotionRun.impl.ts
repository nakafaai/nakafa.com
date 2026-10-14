import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  IDLE_PROGRESS,
  nextStepOf,
  type PromotionStep,
} from "@repo/backend/confect/tenancy/promotion";
import {
  placeApply,
  placeUndo,
} from "@repo/backend/confect/tenancy/promotionPlace";
import spec from "@repo/backend/confect/tenancy/promotionRun.spec";
import { scheduleRun } from "@repo/backend/confect/tenancy/promotionSchedule";
import {
  archiveApply,
  archiveUndo,
  cohortsApply,
  cohortsUndo,
  homeroomApply,
  homeroomUndo,
  type PromotionStepFailure,
  type StepOutcome,
} from "@repo/backend/confect/tenancy/promotionSteps";
import { Array as Arr, Effect, Layer, Option, Result } from "effect";

/** One page or step of work: it reads the promotion and its cursor, and says whether more pages follow. */
type StepRun = (
  promotion: TenantPromotionsDoc,
  actor: typeof TenantActor.Type,
  cursor: string | null
) => Effect.Effect<
  typeof StepOutcome.Type,
  PromotionStepFailure,
  DatabaseReader | DatabaseWriter
>;

/** Each step's work, by the direction of the run that does it. */
const steps: Record<
  "apply" | "undo",
  Record<typeof PromotionStep.Type, StepRun>
> = {
  apply: {
    archive: archiveApply,
    cohorts: cohortsApply,
    homeroom: homeroomApply,
    place: placeApply,
  },
  undo: {
    archive: archiveUndo,
    cohorts: cohortsUndo,
    homeroom: homeroomUndo,
    place: placeUndo,
  },
};

/** Writes the progress of one promotion, keeping its other fields as they are. */
const setProgress = Effect.fn("tenancy.promotionRun.progress")(function* (
  promotion: TenantPromotionsDoc,
  progress: typeof IDLE_PROGRESS
) {
  yield* (yield* DatabaseWriter)
    .table("tenantPromotions")
    .patch(promotion._id, { progress })
    .pipe(Effect.orDie);
});

/**
 * Records a finished step. An apply step moves on to the next step, and the last
 * one ends the apply. An undo step pops the last step done, and undoing the first
 * step returns the promotion to approved, so its plan can be applied again.
 */
const finishStep = Effect.fn("tenancy.promotionRun.finish")(function* (
  promotion: TenantPromotionsDoc,
  actorId: GenericId.GenericId<"tenantPeople">,
  direction: "apply" | "undo",
  step: typeof PromotionStep.Type
) {
  const done =
    direction === "apply"
      ? Arr.append(promotion.progress.done, step)
      : Arr.dropRight(promotion.progress.done, 1);
  if (direction === "undo") {
    if (done.length > 0) {
      return yield* setProgress(promotion, { ...IDLE_PROGRESS, done });
    }
    yield* (yield* DatabaseWriter)
      .table("tenantPromotions")
      .patch(promotion._id, { progress: IDLE_PROGRESS, state: "approved" })
      .pipe(Effect.orDie);
    return;
  }
  const next = nextStepOf(step);
  if (Option.isNone(next)) {
    return yield* setProgress(promotion, { ...IDLE_PROGRESS, done });
  }
  yield* setProgress(promotion, {
    ...IDLE_PROGRESS,
    direction,
    done,
    running: true,
    step: next.value,
  });
  yield* scheduleRun(actorId, promotion._id);
});

/**
 * Runs one page or one step of the promotion's run, the one its progress names. A
 * typed failure stops the run and keeps its step and page, so it resumes there. A
 * page that is not the last schedules the next page, and a finished step moves on.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("tenancy.promotionRun.run")(function* ({ actorId, promotionId }) {
    const promotion = yield* (yield* DatabaseReader)
      .table("tenantPromotions")
      .get(promotionId)
      .pipe(Effect.orDie);
    const { cursor, direction, running, step } = promotion.progress;
    if (!running || direction === null || step === null) {
      return null;
    }
    const actor: typeof TenantActor.Type = { id: actorId, kind: "person" };
    const attempt = yield* steps[direction]
      [step](promotion, actor, cursor)
      .pipe(Effect.result);
    if (Result.isFailure(attempt)) {
      yield* setProgress(promotion, {
        ...promotion.progress,
        failure: attempt.failure._tag,
        running: false,
      });
      return null;
    }
    if (!attempt.success.complete) {
      yield* setProgress(promotion, {
        ...promotion.progress,
        cursor: attempt.success.cursor,
      });
      yield* scheduleRun(actorId, promotionId);
      return null;
    }
    yield* finishStep(promotion, actorId, direction, step);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
