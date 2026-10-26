import { GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { classAccess } from "@repo/backend/confect/classroom/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { gradeAccess } from "@repo/backend/confect/records/authority";
import { enter } from "@repo/backend/confect/records/grades/enter";
import { mine } from "@repo/backend/confect/records/grades/mine";
import { release } from "@repo/backend/confect/records/grades/release";
import { scheme, sheet } from "@repo/backend/confect/records/grades/sheet";
import spec from "@repo/backend/confect/records/grades.spec";
import { Layer } from "effect";

/** The final grades of a class: a subject teacher reads the gradebook, enters and releases grades, and a student reads their own released grade. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(enter),
  Layer.provide(release),
  Layer.provide(sheet),
  Layer.provide(scheme),
  Layer.provide(mine),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(classAccess),
  Layer.provide(gradeAccess),
  GroupImpl.finalize
);
