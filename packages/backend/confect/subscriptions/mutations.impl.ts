import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import spec from "@repo/backend/confect/subscriptions/mutations.spec";
import {
  createSubscriptionRecord,
  updateSubscriptionRecord,
} from "@repo/backend/confect/subscriptions/records/impl";
import { Effect, Layer } from "effect";

const createSubscription = FunctionImpl.make(
  databaseSchema,
  spec,
  "createSubscription",
  Effect.fn("subscriptions.mutations.createSubscription")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* createSubscriptionRecord(ctx, args.subscription);
  })
);
const updateSubscription = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateSubscription",
  Effect.fn("subscriptions.mutations.updateSubscription")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* updateSubscriptionRecord(ctx, args.subscription);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(createSubscription),
  Layer.provide(updateSubscription),
  Layer.provide(atomic),
  GroupImpl.finalize
);
