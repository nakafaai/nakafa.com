import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  ReadPlace,
  ReadView,
} from "@repo/backend/confect/classroom/forum/read";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The read marks of the viewer in a class's forum (ADR 0025): how far the viewer
 * has read a channel or a discussion, and the mark that moves forward as the
 * viewer reads. Whoever reads the forum has read marks, the school's leaders
 * included. A place of another class is refused as a missing object.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({
        classId: Id("classes"),
        place: ReadPlace,
        slug: TenantSlug,
      }),
      returns: () => ReadView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "mark",
      args: () => ({
        at: Schema.Finite,
        classId: Id("classes"),
        place: ReadPlace,
        slug: TenantSlug,
      }),
      returns: () => ReadView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "forum.read", arg: "classId" })
  );
