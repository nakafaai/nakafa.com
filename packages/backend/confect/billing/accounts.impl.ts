import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { linkPolarCustomer } from "@repo/backend/confect/billing/accounts";
import spec from "@repo/backend/confect/billing/accounts.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const linkPolar = FunctionImpl.make(
  databaseSchema,
  spec,
  "linkPolarCustomer",
  Effect.fn("billing.accounts.impl.linkPolarCustomer")(function* (args) {
    return yield* linkPolarCustomer(args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(linkPolar),
  Layer.provide(atomic),
  GroupImpl.finalize
);
