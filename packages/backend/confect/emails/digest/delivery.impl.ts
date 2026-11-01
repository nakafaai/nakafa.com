import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/emails/digest/delivery.spec";
import { renderDigestEmail } from "@repo/email/templates/digest/email";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "render", renderDigestEmail)
  ),
  GroupImpl.finalize
);
