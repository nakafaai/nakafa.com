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
import { checkPlan } from "@repo/backend/confect/tenancy/promotionPlan";
import spec from "@repo/backend/confect/tenancy/promotionReview.spec";
import {
  planOf,
  update,
  view,
} from "@repo/backend/confect/tenancy/promotionRow";
import { Array as Arr, Effect, Layer } from "effect";

/** Submits a draft plan to its principal, once the plan fits the source period as it is now. */
const submit = FunctionImpl.make(
  databaseSchema,
  spec,
  "submit",
  Effect.fn("tenancy.promotionReview.submit")(function* () {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (promotion.state !== "draft") {
      return yield* new PromotionState();
    }
    yield* checkPlan(planOf(promotion));
    const next = yield* update(promotion, { state: "submitted" });
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.submitted",
    });
    return view(next);
  })
);

/** The principal approves a submitted plan, which the Admin may then apply. */
const approve = FunctionImpl.make(
  databaseSchema,
  spec,
  "approve",
  Effect.fn("tenancy.promotionReview.approve")(function* () {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (promotion.state !== "submitted") {
      return yield* new PromotionState();
    }
    const next = yield* update(promotion, { state: "approved" });
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.approved",
    });
    return view(next);
  })
);

/** The principal returns a submitted plan to draft, with the reason code it gives. */
const returnToDraft = FunctionImpl.make(
  databaseSchema,
  spec,
  "returnToDraft",
  Effect.fn("tenancy.promotionReview.returnToDraft")(function* ({ reason }) {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (promotion.state !== "submitted") {
      return yield* new PromotionState();
    }
    const next = yield* update(promotion, {
      returnReason: reason,
      state: "draft",
    });
    yield* promotionAuthority.record(personActor(person), promotion, {
      reason,
      type: "promotion.returned",
    });
    return view(next);
  })
);

/** Cancels a plan that is not applied yet. A cancelled promotion keeps its history and frees its periods. */
const cancel = FunctionImpl.make(
  databaseSchema,
  spec,
  "cancel",
  Effect.fn("tenancy.promotionReview.cancel")(function* () {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (!Arr.contains(["draft", "submitted"], promotion.state)) {
      return yield* new PromotionState();
    }
    const next = yield* update(promotion, { state: "cancelled" });
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.cancelled",
    });
    return view(next);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(submit),
  Layer.provide(approve),
  Layer.provide(returnToDraft),
  Layer.provide(cancel),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(promotionAccess),
  GroupImpl.finalize
);
