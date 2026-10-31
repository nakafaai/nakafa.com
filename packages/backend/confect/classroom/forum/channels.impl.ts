import { GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import { add } from "@repo/backend/confect/classroom/forum/add";
import { archive } from "@repo/backend/confect/classroom/forum/archive";
import spec from "@repo/backend/confect/classroom/forum/channels.spec";
import { list } from "@repo/backend/confect/classroom/forum/list";
import { remove, sweep } from "@repo/backend/confect/classroom/forum/removal";
import { rename } from "@repo/backend/confect/classroom/forum/rename";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Layer } from "effect";

/** The channels of a class: the list a class page reads, and the add, rename, archive and removal a teacher or an Admin makes. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(add),
  Layer.provide(archive),
  Layer.provide(list),
  Layer.provide(remove),
  Layer.provide(rename),
  Layer.provide(sweep),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  GroupImpl.finalize
);
