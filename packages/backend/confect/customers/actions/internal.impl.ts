import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/customers/actions/internal.spec";
import { cleanupDeletedUserBilling } from "@repo/backend/confect/customers/deletion/billing";
import { syncOptionalCustomer } from "@repo/backend/confect/customers/sync/impl";
import { Effect, Layer } from "effect";

const syncCustomer = FunctionImpl.make(
  databaseSchema,
  spec,
  "syncCustomer",
  Effect.fn("customers.actions.internal.syncCustomer")(function* (args) {
    const customer = yield* syncOptionalCustomer(args.userId);
    return customer?.localCustomerId ?? null;
  })
);
const cleanupDeletedUserCustomerData = FunctionImpl.make(
  databaseSchema,
  spec,
  "cleanupDeletedUserCustomerData",
  Effect.fn("customers.actions.internal.cleanupDeletedUserCustomerData")(
    function* (args) {
      return yield* cleanupDeletedUserBilling(args.userId, args.authId);
    }
  )
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(syncCustomer),
  Layer.provide(cleanupDeletedUserCustomerData),
  GroupImpl.finalize
);
