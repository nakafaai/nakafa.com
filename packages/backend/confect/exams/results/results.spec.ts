import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ResultAccess } from "@repo/backend/confect/exams/results/access";
import {
  AnswerRow,
  Overview,
  QuestionStats,
  StudentResult,
  StudentRow,
} from "@repo/backend/confect/exams/results/contract";
import { SittingNotClosed } from "@repo/backend/confect/exams/results/errors";
import {
  NotInSitting,
  QuestionNotInExam,
} from "@repo/backend/confect/exams/sittings/errors";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The results of school exams. An Admin, a teacher, a principal, or the exam's author reads the overview,
 * the students' list, and a question's answers and statistics. The Admin, the exam's author, and the Owner
 * release them, once the sitting is closed. A student reads only the released result of its own attempt
 * (ADR 0031, section 4).
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "overview",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => Overview,
      error: () => AccessDenied,
    }).middleware(ResultAccess, { action: "result.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "byStudent",
      args: () => ({
        sittingId: Id("examSittings"),
        slug: TenantSlug,
        state: Schema.optionalKey(AttemptState),
      }),
      item: () => StudentRow,
      error: () => AccessDenied,
    }).middleware(ResultAccess, { action: "result.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "byQuestion",
      args: () => ({
        questionId: Id("examQuestions"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      item: () => AnswerRow,
      error: () => AccessDenied,
    }).middleware(ResultAccess, { action: "result.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "questionStats",
      args: () => ({
        questionId: Id("examQuestions"),
        sittingId: Id("examSittings"),
        slug: TenantSlug,
      }),
      returns: () => QuestionStats,
      error: () => Schema.Union([AccessDenied, QuestionNotInExam]),
    }).middleware(ResultAccess, { action: "result.view", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "release",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AccessDenied, SittingNotClosed]),
    }).middleware(ResultAccess, { action: "result.release", arg: "sittingId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "mine",
      args: () => ({ sittingId: Id("examSittings"), slug: TenantSlug }),
      returns: () => Schema.NullOr(StudentResult),
      error: () => NotInSitting,
    })
  );
