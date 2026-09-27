import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/credits/mutations.spec";
import {
  getCurrentCreditResetTimestamp,
  upsertStoredCreditResetTimestamp,
} from "@repo/backend/confect/credits/state";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Clock, Effect, Layer } from "effect";

const syncCreditResetPeriod = FunctionImpl.make(
  databaseSchema,
  spec,
  "syncCreditResetPeriod",
  Effect.fn("credits.mutations.syncCreditResetPeriod")(function* (args) {
    yield* upsertStoredCreditResetTimestamp(
      args.plan,
      getCurrentCreditResetTimestamp(args.plan, yield* Clock.currentTimeMillis)
    );
    return null;
  })
);
const syncAllCreditResetPeriods = FunctionImpl.make(
  databaseSchema,
  spec,
  "syncAllCreditResetPeriods",
  Effect.fn("credits.mutations.syncAllCreditResetPeriods")(function* () {
    const now = yield* Clock.currentTimeMillis;
    yield* upsertStoredCreditResetTimestamp(
      "free",
      getCurrentCreditResetTimestamp("free", now)
    );
    yield* upsertStoredCreditResetTimestamp(
      "pro",
      getCurrentCreditResetTimestamp("pro", now)
    );
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(syncCreditResetPeriod),
  Layer.provide(syncAllCreditResetPeriods),
  Layer.provide(atomic),
  GroupImpl.finalize
);
