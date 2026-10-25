import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { DocumentTooLarge } from "@repo/backend/confect/editor/document";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import { ExamFrozen, ExamFull } from "@repo/backend/confect/exams/errors";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import {
  ImportedRead,
  ImportPageRefused,
  ImportUnread,
  MAX_IMPORTED_QUESTIONS,
  MAX_PAGE_TEXT,
  MAX_SOURCE_TEXT,
  PAGES_PER_READ,
  PlacedQuestion,
} from "@repo/backend/confect/exams/import";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The most pictures of a Word file one read shows Nina. */
export const IMAGES_PER_READ = 20;

/** One page of a PDF as the teacher's browser drew it: its uploaded image and its text layer. */
const ImportPage = Schema.Struct({
  image: Id("_storage"),
  text: Schema.String.check(Schema.isMaxLength(MAX_PAGE_TEXT)),
});

/**
 * What one read sends to Nina: up to five pages of a PDF, or the text of a Word file with its
 * equations as XML and its pictures, already images of the exam, in the order `[image N]`
 * marks them. The browser splits a longer file into reads and sends them in order.
 */
export const ImportSource = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("pages"),
    pages: Schema.Array(ImportPage).check(
      Schema.isMinLength(1),
      Schema.isMaxLength(PAGES_PER_READ)
    ),
  }),
  Schema.Struct({
    images: Schema.Array(Id("examAssets")).check(
      Schema.isMaxLength(IMAGES_PER_READ)
    ),
    kind: Schema.Literal("text"),
    text: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(MAX_SOURCE_TEXT)
    ),
  }),
]);

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
 * The import of an exam's questions from a teacher's file. A teacher who may edit the exam sends
 * one read at a time and Nina answers its questions, the figures to cut from its pages, and any
 * answer key table it holds. The browser places the questions at the end of the exam in the
 * order of the file, with their figures as images of the exam, and gives each placed question
 * without a key the answer that a later key table names. `canRead` is the check `read` asks
 * before it calls a model; `pictures` and `discard` are internal.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "canRead",
      args: () => ({ examId: Id("exams"), slug: TenantSlug }),
      returns: () => Schema.Struct({}),
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(ExamAccess, { action: "exam.edit", arg: "examId" })
  )
  .addFunction(
    FunctionSpec.publicAction({
      name: "read",
      args: () => ({
        examId: Id("exams"),
        slug: TenantSlug,
        source: ImportSource,
      }),
      returns: () => ImportedRead,
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          ImportPageRefused,
          ImportUnread,
        ]),
    }).middleware(Session)
  )
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
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "pictures",
      args: () => ({
        assets: Schema.Array(Id("examAssets")).check(
          Schema.isMaxLength(IMAGES_PER_READ)
        ),
        examId: Id("exams"),
      }),
      returns: () => Schema.Array(Schema.Struct({ storageId: Id("_storage") })),
      error: () => AccessDenied,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "discard",
      args: () => ({
        images: Schema.Array(Id("_storage")).check(
          Schema.isMaxLength(PAGES_PER_READ)
        ),
      }),
      returns: () => Schema.Struct({}),
    })
  );
