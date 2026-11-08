import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import {
  expireAttemptAt,
  expireSectionAt,
  sweepTryoutDeadlines,
} from "@repo/backend/confect/tryouts/deadline";
import spec from "@repo/backend/confect/tryouts/mutations/expiry.spec";
import { Effect, Layer } from "effect";

const attempt = FunctionImpl.make(
  databaseSchema,
  spec,
  "attempt",
  Effect.fn("tryouts.mutations.expiry.attempt")(function* (args) {
    return yield* expireAttemptAt(args);
  })
);
const section = FunctionImpl.make(
  databaseSchema,
  spec,
  "section",
  Effect.fn("tryouts.mutations.expiry.section")(function* (args) {
    return yield* expireSectionAt(args);
  })
);
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("tryouts.mutations.expiry.sweep")(function* () {
    return yield* sweepTryoutDeadlines();
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(attempt),
  Layer.provide(section),
  Layer.provide(sweep),
  Layer.provide(atomic),
  GroupImpl.finalize
);
