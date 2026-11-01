import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { ClassView } from "@repo/backend/confect/classroom/classes.spec";
import { ClassInsight, SkillView } from "@repo/backend/confect/insight/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * What Insight shows (ADR 0035): a class as its teachers read it, with each student's chance of reaching the KKTP, and a
 * student's own standing, which holds no chance, because a forecast never leaves the teacher's screen.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "ofClass",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => ClassInsight,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "insight.view", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "classes",
      args: () => ({ slug: TenantSlug }),
      item: () => ClassView,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "mine",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(SkillView),
    })
  );
