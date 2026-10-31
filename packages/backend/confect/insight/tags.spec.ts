import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import { Competency, QuestionTag } from "@repo/backend/confect/insight/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The competency of each question of an exam (ADR 0035). The teacher names it, because Insight never guesses one from a
 * question's text, and a question with none counts for its exam.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => Schema.Array(QuestionTag),
      error: () => AccessDenied,
    }).middleware(ExamAccess, { action: "exam.view", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({
        competency: Schema.NullOr(Competency),
        examId: Id("exams"),
        questionId: Id("examQuestions"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  );
