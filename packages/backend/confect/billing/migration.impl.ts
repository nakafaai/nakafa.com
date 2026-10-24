import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { copyPolarSubscriptionsPage } from "@repo/backend/confect/billing/migration";
import spec from "@repo/backend/confect/billing/migration.spec";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import { Effect, Layer } from "effect";

const copyPage = FunctionImpl.make(
  databaseSchema,
  spec,
  "copyPolarSubscriptionsPage",
  Effect.fn("billing.migration.impl.copyPolarSubscriptionsPage")(
    function* (args) {
      return yield* copyPolarSubscriptionsPage(args);
    }
  )
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(copyPage),
  Layer.provide(atomic),
  GroupImpl.finalize
);
