import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  type DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { promotionLocked } from "@repo/backend/confect/tenancy/authority";
import {
  archiveApply,
  archiveUndo,
} from "@repo/backend/confect/tenancy/promotion/archive";
import {
  cohortsApply,
  cohortsUndo,
} from "@repo/backend/confect/tenancy/promotion/cohorts";
import {
  homeroomApply,
  homeroomUndo,
} from "@repo/backend/confect/tenancy/promotion/homeroom";
import {
  placeApply,
  placeUndo,
} from "@repo/backend/confect/tenancy/promotion/place";
import {
  IDLE_PROGRESS,
  nextStepOf,
  type StepOutcome,
} from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import spec from "@repo/backend/confect/tenancy/promotion/run.spec";
import { scheduleRun } from "@repo/backend/confect/tenancy/promotion/schedule";
import type {
  PromotionStep,
  PromotionStepFailure,
} from "@repo/backend/confect/tenancy/promotion/schema";
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

/**
 * Records a finished step. An apply step moves on to the next step, and the last
 * one ends the apply. An undo step pops the last step done, and undoing the first
 * step returns the promotion to approved, so its plan can be applied again.
 */
const finishStep = Effect.fn("tenancy.promotion.run.finish")(function* (
  promotion: TenantPromotionsDoc,
  actorId: GenericId.GenericId<"tenantPeople">,
  direction: "apply" | "undo",
  step: typeof PromotionStep.Type
) {
  if (direction === "undo") {
    const done = Arr.dropRight(promotion.progress.done, 1);
    if (done.length > 0) {
      yield* update(promotion, { progress: { ...IDLE_PROGRESS, done } });
      return;
    }
    yield* update(promotion, { progress: IDLE_PROGRESS, state: "approved" });
    return;
  }
  const done = Arr.append(promotion.progress.done, step);
  const next = nextStepOf(step);
  if (Option.isNone(next)) {
    yield* update(promotion, { progress: { ...IDLE_PROGRESS, done } });
    return;
  }
  yield* update(promotion, {
    progress: {
      ...IDLE_PROGRESS,
      direction,
      done,
      running: true,
      step: next.value,
    },
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
  Effect.fn("tenancy.promotion.run.run")(function* ({ actorId, promotionId }) {
    const promotion = yield* (yield* DatabaseReader)
      .table("tenantPromotions")
      .get(promotionId)
      .pipe(Effect.orDie);
    const { cursor, direction, running, step } = promotion.progress;
    if (!running || direction === null || step === null) {
      return null;
    }
    // A school archived or a tenant suspended during the run refuses writes, as every
    // public write does. The run stops at this step and resumes once the lock lifts.
    if (yield* promotionLocked(promotion)) {
      const denial = new AccessDenied({
        action: "promotion.apply",
        reason: "condition",
      });
      yield* update(promotion, {
        progress: {
          ...promotion.progress,
          failure: denial._tag,
          running: false,
        },
      });
      return null;
    }
    const actor: typeof TenantActor.Type = { id: actorId, kind: "person" };
    const attempt = yield* steps[direction]
      [step](promotion, actor, cursor)
      .pipe(Effect.result);
    if (Result.isFailure(attempt)) {
      yield* update(promotion, {
        progress: {
          ...promotion.progress,
          failure: attempt.failure._tag,
          running: false,
        },
      });
      return null;
    }
    if (!attempt.success.complete) {
      yield* update(promotion, {
        progress: { ...promotion.progress, cursor: attempt.success.cursor },
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
