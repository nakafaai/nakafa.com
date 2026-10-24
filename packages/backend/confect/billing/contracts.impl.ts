import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { recordSchoolContract } from "@repo/backend/confect/billing/contracts";
import spec from "@repo/backend/confect/billing/contracts.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const recordContract = FunctionImpl.make(
  databaseSchema,
  spec,
  "recordSchoolContract",
  Effect.fn("billing.contracts.impl.recordSchoolContract")(function* (args) {
    return yield* recordSchoolContract(args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(recordContract),
  Layer.provide(atomic),
  GroupImpl.finalize
);
