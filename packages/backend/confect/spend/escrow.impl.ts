import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/spend/escrow.spec";
import { holdSpend, settleSpend } from "@repo/backend/confect/spend/ledger";
import { Effect, Layer } from "effect";

const hold = FunctionImpl.make(
  databaseSchema,
  spec,
  "hold",
  Effect.fn("spend.escrow.hold")(function* ({ claim, held, work }) {
    return yield* holdSpend(claim, work, held);
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

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(hold),
  Layer.provide(settle),
  GroupImpl.finalize
);
