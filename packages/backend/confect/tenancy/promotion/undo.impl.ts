import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Promotion } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  promotionAccess,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { PromotionState } from "@repo/backend/confect/tenancy/errors";
import {
  IDLE_PROGRESS,
  resumePoint,
  stoppedBeforeAnyStep,
} from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import { scheduleRun } from "@repo/backend/confect/tenancy/promotion/schedule";
import spec from "@repo/backend/confect/tenancy/promotion/undo.spec";
import { view } from "@repo/backend/confect/tenancy/promotion/view";
import { Effect, Layer, Option } from "effect";

/**
 * Undoes the last step an applied promotion finished, or resumes a stopped undo. An
 * apply that stopped before any step finished has no step to undo, so undo returns
 * its plan to approved. An opened promotion is locked, so its undo is refused by the
 * access check before this handler runs.
 */
const undo = FunctionImpl.make(
  databaseSchema,
  spec,
  "undo",
  Effect.fn("tenancy.promotion.undo.undo")(function* () {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (promotion.state !== "applied") {
      return yield* new PromotionState();
    }
    const stopped = stoppedBeforeAnyStep(promotion.progress);
    if (Option.isSome(stopped)) {
      const next = yield* update(promotion, {
        progress: IDLE_PROGRESS,
        state: "approved",
      });
      yield* promotionAuthority.record(personActor(person), promotion, {
        step: stopped.value,
        type: "promotion.undone",
      });
      return view(next);
    }
    const point = resumePoint(promotion.progress, "undo");
    if (Option.isNone(point)) {
      return yield* new PromotionState();
    }
    const next = yield* update(promotion, {
      progress: {
        ...promotion.progress,
        cursor: point.value.cursor,
        direction: "undo",
        done: point.value.done,
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
  Layer.provide(undo),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(promotionAccess),
  GroupImpl.finalize
);
