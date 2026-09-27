import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
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
    return yield* expireScheduledAttempt(args);
  })
);
const section = FunctionImpl.make(
  databaseSchema,
  spec,
  "section",
  Effect.fn("tryouts.mutations.expiry.section")(function* (args) {
    return yield* expireScheduledSection(args);
  })
);
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("tryouts.mutations.expiry.sweep")(function* () {
    return yield* startExpirySweep();
  })
);
const reconcileAttempts = FunctionImpl.make(
  databaseSchema,
  spec,
  "reconcileAttempts",
  Effect.fn("tryouts.mutations.expiry.reconcileAttempts")(function* (args) {
    return yield* reconcileMissedAttemptExpiries(args.before);
  })
);
const reconcileSections = FunctionImpl.make(
  databaseSchema,
  spec,
  "reconcileSections",
  Effect.fn("tryouts.mutations.expiry.reconcileSections")(function* (args) {
    return yield* reconcileMissedSectionExpiries({
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
