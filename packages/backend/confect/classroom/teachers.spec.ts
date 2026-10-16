import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  PersonClassLimit,
  PersonNotTeacher,
} from "@repo/backend/confect/classroom/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One subject teacher as a class's list shows them. */
const TeacherView = Schema.Struct({
  id: Id("tenantPeople"),
  name: PersonName,
});

/**
 * The subject teachers of a class. The Admin assigns and removes them, to a
 * Person who holds a teacher grant over the class's unit. The roles that lead the
 * school, and the teachers and students of the class, read the list.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "assign",
      args: () => ({
        classId: Id("classes"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => TeacherView,
      error: () =>
        Schema.Union([AccessDenied, PersonClassLimit, PersonNotTeacher]),
    }).middleware(ClassAccess, { action: "class.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({
        classId: Id("classes"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Struct({ id: Id("tenantPeople") }),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "class.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      item: () => TeacherView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "class.view", arg: "classId" })
  );
