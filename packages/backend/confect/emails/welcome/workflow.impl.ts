import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { deliverWelcomeEmail } from "@repo/backend/confect/emails/welcome/workflow";
import spec from "@repo/backend/confect/emails/welcome/workflow.spec";
import { Layer } from "effect";
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "deliverWelcomeEmail",
      deliverWelcomeEmail
    )
  ),
  GroupImpl.finalize
);
