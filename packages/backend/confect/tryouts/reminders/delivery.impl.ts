import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/tryouts/reminders/delivery.spec";
import { renderReminderEmail } from "@repo/email/templates/reminder/email";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "render", renderReminderEmail)
  ),
  GroupImpl.finalize
);
