import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What a Person is in a class: one who teaches it, or a student placed in its cohort. */
export const ClassPersonKind = Schema.Literals(["student", "teacher"]);

/** One Person of a class as its People tab shows them. `email` reaches only who keeps the class (`list`). */
export const ClassPerson = Schema.Struct({
  email: Schema.NullOr(Schema.String),
  id: Id("tenantPeople"),
  joined: Schema.Boolean,
  kind: ClassPersonKind,
  name: Schema.String,
});

/**
 * The People tab of a class: who teaches it and who learns in it (ADR 0025).
 * Whoever may view the class reads the list, its members and the leaders of the
 * school. A teacher is managed in the school's settings, and a student through
 * their cohort, so a class page only reads. An address is personal, so only a
 * viewer who keeps the class's tasks reads it, never a classmate.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => Schema.Array(ClassPerson),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "class.view", arg: "classId" })
  );
