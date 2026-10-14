import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/emails/invite/delivery.spec";
import { renderInviteEmail } from "@repo/email/templates/invite/email";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "render", renderInviteEmail)
  ),
  GroupImpl.finalize
);
