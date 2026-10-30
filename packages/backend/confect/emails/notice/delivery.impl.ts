import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import spec from "@repo/backend/confect/emails/notice/delivery.spec";
import { renderNoticeEmail } from "@repo/email/templates/notice/email";
import { Layer } from "effect";

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(
    FunctionImpl.make(databaseSchema, spec, "render", renderNoticeEmail)
  ),
  GroupImpl.finalize
);
