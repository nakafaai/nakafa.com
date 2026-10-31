import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import { NarrativeMissing } from "@repo/backend/confect/insight/errors";
import { NarrativeText } from "@repo/backend/confect/insight/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What names one student of one class. */
const Student = {
  classId: Id("classes"),
  personId: Id("tenantPeople"),
  slug: TenantSlug,
};

/**
 * What a teacher says about a student (ADR 0035): the teacher writes it, sealed with the school key, decides when the
 * student's guardians read it, and can take that back from the same page.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "write",
      args: () => ({ ...Student, text: NarrativeText }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "insight.teach", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "share",
      args: () => Student,
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, NarrativeMissing]),
    }).middleware(ClassAccess, { action: "insight.teach", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "withdraw",
      args: () => Student,
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, NarrativeMissing]),
    }).middleware(ClassAccess, { action: "insight.teach", arg: "classId" })
  );
