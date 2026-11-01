import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { entries } from "@repo/backend/confect/access/catalog";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { Kind } from "@repo/backend/confect/access/kind";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { ClassAccess } from "@repo/backend/confect/classroom/access";
import {
  CLASS_TEACHERS_ASK_LIMIT,
  ClassAddress,
  ClassName,
  ClassStatus,
  ClassSubject,
} from "@repo/backend/confect/classroom/class";
import {
  ClassAddressEmpty,
  ClassAmbiguous,
  ClassLimit,
  ClassNameTaken,
  ClassSubjectNotAllowed,
  ClassSubjectRequired,
  ClassSubjectTaken,
} from "@repo/backend/confect/classroom/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  CohortAccess,
  PeriodAccess,
} from "@repo/backend/confect/tenancy/access";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * One class as the wire shows it. `subject` is absent for the homeroom class of a
 * cohort, which is named for the cohort alone.
 */
export const ClassView = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  id: Id("classes"),
  name: ClassName,
  periodId: Id("tenantPeriods"),
  slug: Schema.String,
  status: ClassStatus,
  subject: Schema.optionalKey(ClassSubject),
});

/**
 * A class as `resolve` returns it: the class, the class actions the caller holds
 * on it, and whether the caller may open a discussion in its forum, so a page
 * offers only the actions the caller may take.
 */
export const ClassResolved = Schema.Struct({
  ...ClassView.fields,
  can: Schema.Array(Kind.actions(entries, "class")),
  opens: Schema.Boolean,
});

/**
 * The classes of a school. The Admin creates, renames, and archives them. The
 * roles that lead the school read a period's classes and each class, and a
 * subject teacher or a student placed in the cohort reads its own classes. A
 * member resolves a class by its address, and the class's read rule decides it.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        slug: TenantSlug,
        subject: Schema.optionalKey(ClassSubject),
      }),
      returns: () => ClassView,
      error: () =>
        Schema.Union([
          AccessDenied,
          ClassAddressEmpty,
          ClassAmbiguous,
          ClassLimit,
          ClassNameTaken,
          ClassSubjectNotAllowed,
          ClassSubjectRequired,
          ClassSubjectTaken,
        ]),
    }).middleware(CohortAccess, { action: "class.create", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({
        classId: Id("classes"),
        name: ClassName,
        slug: TenantSlug,
      }),
      returns: () => ClassView,
      error: () => Schema.Union([AccessDenied, ClassNameTaken]),
    }).middleware(ClassAccess, { action: "class.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "changeSubject",
      args: () => ({
        classId: Id("classes"),
        slug: TenantSlug,
        subject: ClassSubject,
      }),
      returns: () => ClassView,
      error: () =>
        Schema.Union([
          AccessDenied,
          ClassNameTaken,
          ClassSubjectNotAllowed,
          ClassSubjectTaken,
        ]),
    }).middleware(ClassAccess, { action: "class.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archive",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => ClassView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "class.manage", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "restore",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => ClassView,
      error: () =>
        Schema.Union([
          AccessDenied,
          ClassAmbiguous,
          ClassNameTaken,
          ClassSubjectTaken,
        ]),
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ classId: Id("classes"), slug: TenantSlug }),
      returns: () => ClassView,
      error: () => AccessDenied,
    }).middleware(ClassAccess, { action: "class.view", arg: "classId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
      item: () => ClassView,
      error: () => AccessDenied,
    }).middleware(PeriodAccess, { action: "class.list", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "teachers",
      args: () => ({
        classIds: Schema.Array(Id("classes")).check(
          Schema.isMaxLength(CLASS_TEACHERS_ASK_LIMIT)
        ),
        periodId: Id("tenantPeriods"),
        slug: TenantSlug,
      }),
      returns: () =>
        Schema.Array(
          Schema.Struct({
            classId: Id("classes"),
            names: Schema.Array(PersonName),
          })
        ),
      error: () => AccessDenied,
    }).middleware(PeriodAccess, { action: "class.list", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "mine",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(ClassView),
      error: () => Schema.Never,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "resolve",
      args: () => ({ classSlug: ClassAddress, slug: TenantSlug }),
      returns: () => ClassResolved,
      error: () => Schema.Union([AccessDenied, ClassAmbiguous]),
    })
  );
