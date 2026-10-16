import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Promotion } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  promotionAccess,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  PromotionState,
  SourcePeriodInvalid,
} from "@repo/backend/confect/tenancy/errors";
import spec from "@repo/backend/confect/tenancy/promotion/apply.spec";
import { checkPlan } from "@repo/backend/confect/tenancy/promotion/check";
import {
  IDLE_PROGRESS,
  resumePoint,
} from "@repo/backend/confect/tenancy/promotion/progress";
import { planOf, update } from "@repo/backend/confect/tenancy/promotion/row";
import { scheduleRun } from "@repo/backend/confect/tenancy/promotion/schedule";
import { view } from "@repo/backend/confect/tenancy/promotion/view";
import { Effect, Layer, Option } from "effect";

/**
 * Checks what applying needs before the first step: the source period is still
 * active and the plan still fits. The target stays planned, because an approved
 * promotion refuses its target's opening, so it needs no check here.
 */
const checkStart = Effect.fn("tenancy.promotion.apply.checkStart")(function* (
  promotion: TenantPromotionsDoc
) {
  const source = yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(promotion.sourcePeriodId)
    .pipe(Effect.orDie);
  if (source.status !== "active") {
    return yield* new SourcePeriodInvalid();
  }
  yield* checkPlan(planOf(promotion));
});

/**
 * Starts applying an approved promotion, or resumes a stopped apply at its step and
 * page. The run itself runs in `run`, one page or one step at a time.
 */
const apply = FunctionImpl.make(
  databaseSchema,
  spec,
  "apply",
  Effect.fn("tenancy.promotion.apply.apply")(function* () {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (promotion.state === "approved") {
      yield* checkStart(promotion);
      const next = yield* update(promotion, {
        progress: {
          ...IDLE_PROGRESS,
          direction: "apply",
          running: true,
          step: "archive",
        },
        state: "applied",
      });
      yield* promotionAuthority.record(personActor(person), promotion, {
        type: "promotion.applied",
      });
      yield* scheduleRun(person._id, promotion._id);
      return view(next);
    }
    if (promotion.state !== "applied") {
      return yield* new PromotionState();
    }
    const point = resumePoint(promotion.progress, "apply");
    if (Option.isNone(point)) {
      return yield* new PromotionState();
    }
    const next = yield* update(promotion, {
      progress: {
        ...promotion.progress,
        cursor: point.value.cursor,
        direction: "apply",
        failure: null,
        running: true,
        step: point.value.step,
      },
    });
    yield* scheduleRun(person._id, promotion._id);
    return view(next);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(apply),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(promotionAccess),
  GroupImpl.finalize
);
