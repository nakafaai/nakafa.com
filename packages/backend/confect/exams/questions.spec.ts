import { FunctionSpec, GroupSpec } from "@confect/core";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { DocumentTooLarge } from "@repo/backend/confect/editor/document";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import {
  AnswersDoNotFit,
  ExamEmpty,
  ExamFrozen,
  ExamFull,
  KeyDoesNotFit,
  QuestionHistoryLong,
  RevisionStale,
} from "@repo/backend/confect/exams/errors";
import {
  QuestionPoints,
  QuestionTemplate,
  QuestionView,
} from "@repo/backend/confect/exams/question";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The order of an exam's questions after a removal or a move. */
const QuestionOrder = Schema.Struct({
  questions: Schema.Array(Id("examQuestions")),
});

/**
 * The questions of an exam. A Teacher or an Admin whose grant covers the exam adds,
 * copies, removes, moves, and answers its questions, and every one of them names its
 * exam, so a question of another exam is refused as a missing object. A question
 * takes another template (K23) at the revision its editor saw.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "add",
      args: () => ({
        after: Schema.NullOr(Id("examQuestions")),
        examId: Id("exams"),
        slug: TenantSlug,
      }),
      returns: () => QuestionView,
      error: () =>
        Schema.Union([AccessDenied, DocumentTooLarge, ExamFrozen, ExamFull]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "copy",
      args: () => ({
        examId: Id("exams"),
        questionId: Id("examQuestions"),
        slug: TenantSlug,
      }),
      returns: () => QuestionView,
      error: () =>
        Schema.Union([
          AccessDenied,
          DocumentTooLarge,
          ExamFrozen,
          ExamFull,
          QuestionHistoryLong,
        ]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({
        examId: Id("exams"),
        questionId: Id("examQuestions"),
        slug: TenantSlug,
      }),
      returns: () => QuestionOrder,
      error: () => Schema.Union([AccessDenied, ExamEmpty, ExamFrozen]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "move",
      args: () => ({
        examId: Id("exams"),
        index: Schema.Natural,
        questionId: Id("examQuestions"),
        slug: TenantSlug,
      }),
      returns: () => QuestionOrder,
      error: () => Schema.Union([AccessDenied, ExamFrozen]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "points",
      args: () => ({
        examId: Id("exams"),
        points: QuestionPoints,
        questionId: Id("examQuestions"),
        slug: TenantSlug,
      }),
      returns: () => QuestionView,
      error: () => Schema.Union([AccessDenied, ExamFrozen]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "answer",
      args: () => ({
        answers: Schema.NonEmptyArray(InteractionSchema),
        examId: Id("exams"),
        key: Schema.NullOr(Schema.NonEmptyArray(InteractionKeySchema)),
        questionId: Id("examQuestions"),
        revision: Schema.Natural,
        slug: TenantSlug,
      }),
      returns: () => QuestionView,
      error: () =>
        Schema.Union([
          AccessDenied,
          AnswersDoNotFit,
          DocumentTooLarge,
          ExamFrozen,
          KeyDoesNotFit,
          RevisionStale,
        ]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "template",
      args: () => ({
        examId: Id("exams"),
        questionId: Id("examQuestions"),
        revision: Schema.Natural,
        slug: TenantSlug,
        template: QuestionTemplate,
      }),
      returns: () => QuestionView,
      error: () =>
        Schema.Union([
          AccessDenied,
          DocumentTooLarge,
          ExamFrozen,
          RevisionStale,
        ]),
    }).middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  );
