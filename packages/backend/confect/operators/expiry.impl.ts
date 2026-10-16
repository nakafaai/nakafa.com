import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/operators/expiry.spec";
import { expireVisit } from "@repo/backend/confect/operators/visit";
import { Clock, Effect, Layer } from "effect";

/** The most visits one sweep run ends. A longer backlog drains over later runs. */
const VISIT_SWEEP_BATCH_SIZE = 50;

/** Ends one visit when its term has run out, if the school or the operator did not end it first. */
const visit = FunctionImpl.make(
  databaseSchema,
  spec,
  "visit",
  Effect.fn("operators.expiry.visit")(function* ({ visitId }) {
    const stored = yield* (yield* DatabaseReader)
      .table("tenantVisits")
      .get(visitId)
      .pipe(Effect.orDie);
    yield* expireVisit(stored);
    return null;
  })
);

/** The hourly backstop: ends every approved visit whose term has passed, though its own run never happened. */
const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("operators.expiry.sweep")(function* () {
    const reader = yield* DatabaseReader;
    const now = yield* Clock.currentTimeMillis;
    const due = yield* reader
      .table("tenantVisits")
      .index("by_state_status_and_state_expiresAt", (query) =>
        query.eq("state.status", "approved").lte("state.expiresAt", now)
      )
      .take(VISIT_SWEEP_BATCH_SIZE)
      .pipe(Effect.orDie);
    yield* Effect.forEach(due, expireVisit, { discard: true });
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(visit),
  Layer.provide(sweep),
  GroupImpl.finalize
);
