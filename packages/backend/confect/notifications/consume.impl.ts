import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/notifications/consume.spec";
import {
  consumeInboxPage,
  INBOX_PAGE_SIZE,
  scheduleDueRuns,
} from "@repo/backend/confect/notifications/inbox";
import { Effect, Layer } from "effect";

const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("notifications.consume.run")(function* ({ tenantId }) {
    yield* consumeInboxPage(tenantId, INBOX_PAGE_SIZE);
    return null;
  })
);

const sweep = FunctionImpl.make(
  databaseSchema,
  spec,
  "sweep",
  Effect.fn("notifications.consume.sweep")(function* () {
    yield* scheduleDueRuns();
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  Layer.provide(sweep),
  GroupImpl.finalize
);
