import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  cancelXenditPlan,
  deactivateCanceledPlan,
} from "@repo/backend/confect/billing/xendit/cancel";
import spec from "@repo/backend/confect/billing/xendit/cancel.spec";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const cancelPlan = FunctionImpl.make(
  databaseSchema,
  spec,
  "cancelPlan",
  Effect.fn("billing.xendit.cancel.cancelPlan")(function* () {
    const { appUser } = yield* requireAuth();
    return yield* cancelXenditPlan(appUser._id);
  })
);

const deactivate = FunctionImpl.make(
  databaseSchema,
  spec,
  "deactivate",
  Effect.fn("billing.xendit.cancel.deactivate")(function* ({ planId }) {
    return yield* deactivateCanceledPlan(planId);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(cancelPlan),
  Layer.provide(deactivate),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
