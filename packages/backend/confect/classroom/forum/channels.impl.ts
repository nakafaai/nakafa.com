import { GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { add } from "@repo/backend/confect/classroom/forum/add";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { list } from "@repo/backend/confect/classroom/forum/list";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Layer } from "effect";

/** The channels of a class: the list a class page reads, and the add a teacher or an Admin makes. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(add),
  Layer.provide(list),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
