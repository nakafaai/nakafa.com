import { GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import session from "@repo/backend/confect/middleware/session.impl";
import { page as pageImpl } from "@repo/backend/confect/nina/messages/page";
import spec from "@repo/backend/confect/nina/messages.spec";
import { Layer } from "effect";

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(pageImpl),
  Layer.provide(session),
  GroupImpl.finalize
);
