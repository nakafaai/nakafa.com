import { FunctionImpl, GroupImpl } from "@confect/server";
import spendInternal from "@repo/backend/confect/_generated/refs/spend.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/spend/escrow.spec";
import {
  foldSpend,
  holdSpend,
  settleSpend,
} from "@repo/backend/confect/spend/ledger";
import { Duration, Effect, Layer } from "effect";

const hold = FunctionImpl.make(
  databaseSchema,
  spec,
  "hold",
  Effect.fn("spend.escrow.hold")(function* ({ ceiling, claim, work }) {
    return yield* holdSpend(claim, work, ceiling);
  })
);

const settle = FunctionImpl.make(
  databaseSchema,
  spec,
  "settle",
  Effect.fn("spend.escrow.settle")(function* ({ escrowId, spent }) {
    yield* settleSpend(escrowId, spent);
    return null;
  })
);

const fold = FunctionImpl.make(
  databaseSchema,
  spec,
  "fold",
  Effect.fn("spend.escrow.fold")(function* () {
    // A burst of calls, such as a release's re-embed, can leave more escrows
    // than one fold counts; the next fold then runs at once, not a minute later.
    if (yield* foldSpend()) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        spendInternal.escrow.fold,
        {}
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(hold),
  Layer.provide(settle),
  Layer.provide(fold),
  GroupImpl.finalize
);
