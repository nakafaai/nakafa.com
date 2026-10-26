import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { deliverPassReminderProgram } from "@repo/backend/confect/billing/reminder/delivery";
import spec from "@repo/backend/confect/billing/reminder/delivery.spec";
import { Effect, Layer } from "effect";

const deliver = FunctionImpl.make(
  databaseSchema,
  spec,
  "deliver",
  Effect.fn("billing.reminder.delivery.deliver")(function* ({
    grantId,
    locale,
  }) {
    const { runQuery } = yield* QueryRunner;
    const { runMutation } = yield* MutationRunner;
    return yield* deliverPassReminderProgram(
      runQuery(refs.internal.billing.reminder.internal.readInput, {
        grantId,
        locale,
      }).pipe(Effect.catchTag("SchemaError", Effect.die)),
      (message) =>
        runMutation(refs.internal.billing.reminder.internal.enqueue, {
          grantId,
          ...message,
        }).pipe(Effect.catchTag("SchemaError", Effect.die))
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(deliver),
  GroupImpl.finalize
);
