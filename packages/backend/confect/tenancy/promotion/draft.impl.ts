import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeriodsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Period, Promotion } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  periodAccess,
  periodAuthority,
  promotionAccess,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  PromotionState,
  SourcePeriodInvalid,
  TargetPeriodInvalid,
} from "@repo/backend/confect/tenancy/errors";
import {
  checkPlan,
  targetNamesFree,
} from "@repo/backend/confect/tenancy/promotion/check";
import spec from "@repo/backend/confect/tenancy/promotion/draft.spec";
import {
  liveForSource,
  liveForTarget,
  shownForSource,
} from "@repo/backend/confect/tenancy/promotion/find";
import { IDLE_PROGRESS } from "@repo/backend/confect/tenancy/promotion/progress";
import {
  PLANNABLE,
  planOf,
  update,
} from "@repo/backend/confect/tenancy/promotion/row";
import { view } from "@repo/backend/confect/tenancy/promotion/view";
import { Array as Arr, Effect, Layer, Option } from "effect";

/**
 * Whether a period is a planned target of a source period: the same unit, planned,
 * and starting after the source period ends. Dates are calendar dates, so text
 * order is date order.
 */
const isTargetOf = (source: TenantPeriodsDoc, target: TenantPeriodsDoc) =>
  target.unitId === source.unitId &&
  target.status === "planned" &&
  target.start > source.end;

/** Shows the promotion of a school period that the wizard shows: never a cancelled one. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.promotion.draft.get")(function* () {
    const period = yield* Period;
    const shown = yield* shownForSource(period._id);
    return Option.match(shown, { onNone: () => null, onSome: view });
  })
);

/**
 * Starts a promotion of an active school period to a planned period of the same
 * school that starts after it ends. A period has one live promotion at a time, and
 * a target period is the target of one live promotion at a time.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("tenancy.promotion.draft.create")(function* ({ targetPeriodId }) {
    const { person } = yield* Member;
    const period = yield* Period;
    if (period.status !== "active") {
      return yield* new SourcePeriodInvalid();
    }
    if (Option.isSome(yield* liveForSource(period._id))) {
      return yield* new PromotionState();
    }
    const target = yield* periodAuthority.authorize(
      "period.manage",
      targetPeriodId
    );
    if (!isTargetOf(period, target)) {
      return yield* new TargetPeriodInvalid();
    }
    if (Option.isSome(yield* liveForTarget(target._id))) {
      return yield* new TargetPeriodInvalid();
    }
    const promotionId = yield* (yield* DatabaseWriter)
      .table("tenantPromotions")
      .insert({
        copies: [],
        created: [],
        progress: IDLE_PROGRESS,
        returnReason: null,
        sourcePeriodId: period._id,
        sources: [],
        state: "draft",
        targetPeriodId: target._id,
        targets: [],
        tenantId: period.tenantId,
        unitId: period.unitId,
      })
      .pipe(Effect.orDie);
    const promotion = yield* (yield* DatabaseReader)
      .table("tenantPromotions")
      .get(promotionId)
      .pipe(Effect.orDie);
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.created",
    });
    return view(promotion);
  })
);

/**
 * Replaces the plan of a promotion: its new cohorts and what each source cohort
 * becomes. The plan must fit the source period as it is now, and its names must be
 * free in the target period. Editing a submitted or approved plan sends it back to
 * draft, so the principal approves what is applied.
 */
const plan = FunctionImpl.make(
  databaseSchema,
  spec,
  "plan",
  Effect.fn("tenancy.promotion.draft.plan")(function* ({ sources, targets }) {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (!Arr.contains(PLANNABLE, promotion.state)) {
      return yield* new PromotionState();
    }
    yield* checkPlan({ ...planOf(promotion), sources, targets });
    yield* targetNamesFree(promotion.targetPeriodId, targets);
    const next = yield* update(promotion, {
      returnReason: null,
      sources,
      state: "draft",
      targets,
    });
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.planned",
    });
    return view(next);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(create),
  Layer.provide(plan),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(periodAccess),
  Layer.provide(promotionAccess),
  GroupImpl.finalize
);
