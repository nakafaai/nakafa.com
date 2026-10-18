import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { GradeAccess } from "@repo/backend/confect/records/access";
import {
  GradeNotPlaced,
  GradeReleased,
} from "@repo/backend/confect/records/errors";
import { GradeView } from "@repo/backend/confect/records/grade";
import { GradeValue } from "@repo/backend/confect/records/scheme";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The final grades of a class. A subject teacher of the class enters a draft for a
 * student placed in its cohort, releases it, and lists the class's grades. A
 * student reads only their own released grade, through `mine`.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "enter",
      args: () => ({
        classId: Id("classes"),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
        value: GradeValue,
      }),
      returns: () => GradeView,
      error: () => Schema.Union([AccessDenied, GradeNotPlaced, GradeReleased]),
    }).middleware(ClassAccess, { action: "grade.enter", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "release",
      args: () => ({ gradeId: Id("classGrades"), slug: TenantSlug }),
      returns: () => GradeView,
      error: () => AccessDenied,
    }).middleware(GradeAccess, { action: "grade.release", arg: "gradeId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      item: () => GradeView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "grade.list", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "mine",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => Schema.Array(GradeView),
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "class.view", arg: "classId" })
  );
