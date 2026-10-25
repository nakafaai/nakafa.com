import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { DocumentTooLarge } from "@repo/backend/confect/editor/document";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import { ExamFrozen, ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import {
  MAX_IMPORTED_QUESTIONS,
  PlacedQuestion,
} from "@repo/backend/confect/exams/import";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * What one placement put in the exam: each placed question's ID with the number its file gave
 * it, in order, how many of them have no key yet, and how many questions were not a choice of
 * two to five options and were left out.
 */
export const ImportPlaced = Schema.Struct({
  keyless: Schema.Int,
  left: Schema.Int,
  placed: Schema.Array(
    Schema.Struct({
      id: Id("examQuestions"),
      number: Schema.NullOr(Schema.Int),
    })
  ),
});

/**
 * The placement of the questions Nina read from a teacher's file. The browser places each part's
 * questions at the end of the exam in the order of the file, with their figures as images of the
 * exam, and gives each placed question without a key the answer that a later key table names.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "place",
      args: () => ({
        examId: Id("exams"),
        questions: Schema.Array(PlacedQuestion).check(
          Schema.isMaxLength(MAX_IMPORTED_QUESTIONS)
        ),
        slug: TenantSlug,
      }),
      returns: () => ImportPlaced,
      error: () =>
        Schema.Union([AccessDenied, DocumentTooLarge, ExamFrozen, ExamFull]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "keys",
      args: () => ({
        examId: Id("exams"),
        keys: Schema.Array(
          Schema.Struct({ answer: Schema.Int, questionId: Id("examQuestions") })
        ).check(Schema.isMaxLength(MAX_EXAM_QUESTIONS)),
        slug: TenantSlug,
      }),
      returns: () => Schema.Struct({ keyed: Schema.Int }),
      error: () => Schema.Union([AccessDenied, ExamFrozen]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  );
