import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { MentionablePerson } from "@repo/backend/confect/classroom/forum/mention";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The Persons a writer may mention in a class's forum: the members who write in
 * it now, the writer left out, by name (ADR 0025). Only whoever writes in the
 * forum reads the list.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => Schema.Array(MentionablePerson),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.post", arg: "classId" })
  );
