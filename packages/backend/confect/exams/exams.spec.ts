import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { DocumentTooLarge } from "@repo/backend/confect/editor/document";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import {
  ExamSummary,
  ExamTitle,
  ExamView,
} from "@repo/backend/confect/exams/exam";
import { HomeView } from "@repo/backend/confect/exams/home/contract";
import {
  ScheduleCohort,
  ScheduleResult,
} from "@repo/backend/confect/exams/sittings/contract";
import {
  KeysMissing,
  ScheduleInvalid,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  RoomName,
  SittingGroup,
} from "@repo/backend/confect/exams/sittings/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The school exams. A Teacher, an Admin, or the Owner creates an exam in a scope
 * they may edit, lists and opens the exams they may view, and renames an exam they
 * may edit. Each exam starts with one question, so an exam is never empty.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        scope: GrantScope,
        slug: TenantSlug,
        title: ExamTitle,
      }),
      returns: () => Schema.Struct({ id: Id("exams") }),
      error: () => Schema.Union([AccessDenied, DocumentTooLarge]),
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => ExamSummary,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "home",
      args: () => ({ slug: TenantSlug }),
      returns: () => HomeView,
      error: () => Schema.Never,
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "open",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => ExamView,
      error: () => AccessDenied,
    }).middleware(ExamAccess, { action: "exam.view", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({
        examId: Id("exams"),
        slug: TenantSlug,
        title: ExamTitle,
      }),
      returns: () => ExamSummary,
      error: () => AccessDenied,
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "schedule",
      args: () => ({
        closesAt: Schema.Finite,
        examId: Id("exams"),
        group: SittingGroup,
        opensAt: Schema.Finite,
        room: RoomName,
        slug: TenantSlug,
      }),
      returns: () => ScheduleResult,
      error: () => Schema.Union([AccessDenied, KeysMissing, ScheduleInvalid]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "cohorts",
      args: () => ({ slug: TenantSlug, unitId: Id("tenantUnits") }),
      returns: () => Schema.Array(ScheduleCohort),
      error: () => AccessDenied,
    })
  );
