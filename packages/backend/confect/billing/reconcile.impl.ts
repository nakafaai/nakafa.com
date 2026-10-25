import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  applyReconciledSubscription,
  reconcilePolarSubscriptions,
} from "@repo/backend/confect/billing/reconcile";
import spec from "@repo/backend/confect/billing/reconcile.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("billing.reconcile.impl.run")(function* (args) {
    return yield* reconcilePolarSubscriptions(args.page);
  })
);

const applySubscription = FunctionImpl.make(
  databaseSchema,
  spec,
  "applySubscription",
  Effect.fn("billing.reconcile.impl.applySubscription")(function* (args) {
    return yield* applyReconciledSubscription(args.subscription);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  Layer.provide(applySubscription),
  Layer.provide(atomic),
  GroupImpl.finalize
);
