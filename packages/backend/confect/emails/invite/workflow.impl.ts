import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { finishInviteEmail } from "@repo/backend/confect/emails/invite/completion";
import { deliverInviteEmail } from "@repo/backend/confect/emails/invite/workflow";
import spec from "@repo/backend/confect/emails/invite/workflow.spec";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "deliverInviteEmail",
      deliverInviteEmail
    )
  ),
  Layer.provide(
    FunctionImpl.make(
      databaseSchema,
      spec,
      "finishInviteEmail",
      finishInviteEmail
    )
  ),
  GroupImpl.finalize
);
