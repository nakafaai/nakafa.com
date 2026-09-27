import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import {
  expireScheduledAttempt,
  expireScheduledSection,
  reconcileMissedAttemptExpiries,
  reconcileMissedSectionExpiries,
  startExpirySweep,
} from "@repo/backend/confect/tryouts/mutations/expiry";
import spec from "@repo/backend/confect/tryouts/mutations/expiry.spec";
import { Effect, Layer } from "effect";

const attempt = FunctionImpl.make(
  databaseSchema,
  spec,
  "attempt",
  Effect.fn("tryouts.mutations.expiry.attempt")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* expireScheduledAttempt(ctx, args);
  })
);
const section = FunctionImpl.make(
  databaseSchema,
  spec,
  "section",
  Effect.fn("tryouts.mutations.expiry.section")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* expireScheduledSection(ctx, args);
  })
);
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("tryouts.mutations.expiry.sweep")(function* () {
    const ctx = yield* MutationCtxService;
    return yield* startExpirySweep(ctx);
  })
);
const reconcileAttempts = FunctionImpl.make(
  databaseSchema,
  spec,
  "reconcileAttempts",
  Effect.fn("tryouts.mutations.expiry.reconcileAttempts")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* reconcileMissedAttemptExpiries(ctx, args.before);
  })
);
const reconcileSections = FunctionImpl.make(
  databaseSchema,
  spec,
  "reconcileSections",
  Effect.fn("tryouts.mutations.expiry.reconcileSections")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* reconcileMissedSectionExpiries(ctx, {
      before: args.before,
      scheduledAttemptIds: args.scheduledAttemptIds,
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(attempt),
  Layer.provide(section),
  Layer.provide(sweep),
  Layer.provide(reconcileAttempts),
  Layer.provide(reconcileSections),
  Layer.provide(atomic),
  GroupImpl.finalize
);
