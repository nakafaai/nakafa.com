import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { polarGateway } from "@repo/backend/confect/billing/polar/live";
import spec from "@repo/backend/confect/billing/topup.spec";
import { Effect, Layer } from "effect";

const refundWithoutPro = FunctionImpl.make(
  databaseSchema,
  spec,
  "refundWithoutPro",
  Effect.fn("billing.topup.impl.refundWithoutPro")(function* (args) {
    yield* polarGateway.refundOrder(args);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(refundWithoutPro),
  GroupImpl.finalize
);
