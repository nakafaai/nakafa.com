import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { DocumentTooLarge } from "@repo/backend/confect/editor/document";
import { ExamAccess } from "@repo/backend/confect/exams/access";
import { ExamFrozen, ExamFull } from "@repo/backend/confect/exams/errors";
import {
  ImportedQuestion,
  ImportPageRefused,
  ImportUnread,
  MAX_IMPORTED_QUESTIONS,
  MAX_PAGE_TEXT,
  MAX_SOURCE_TEXT,
  PAGES_PER_READ,
} from "@repo/backend/confect/exams/import";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One page of a PDF as the teacher's browser drew it: its uploaded image and its text layer. */
const ImportPage = Schema.Struct({
  image: Id("_storage"),
  text: Schema.String.check(Schema.isMaxLength(MAX_PAGE_TEXT)),
});

/**
 * What one read sends to Nina: up to five pages of a PDF, or the text of a Word file with its
 * equations as XML. The browser splits a longer file into reads and sends them in order.
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
    kind: Schema.Literal("text"),
    text: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(MAX_SOURCE_TEXT)
    ),
  }),
]);

/**
 * What one read placed: the questions now in the exam, how many of them have no key yet, and how
 * many questions Nina read that are not a choice of two to five options and were left out.
 */
export const ImportPlaced = Schema.Struct({
  keyless: Schema.Int,
  left: Schema.Int,
  placed: Schema.Int,
});

/**
 * The import of an exam's questions from a teacher's file. A teacher who may edit the exam sends
 * one read at a time: Nina reads it, and the questions she finds are placed at the end of the
 * exam in the order of the file, each with its key when the file marks one. `canRead` is the
 * check `read` asks before it calls a model; `place` and `discard` are internal.
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
      returns: () => ImportPlaced,
      error: () =>
        Schema.Union([
          AuthFailure,
          AccessDenied,
          DocumentTooLarge,
          ExamFrozen,
          ExamFull,
          ImportPageRefused,
          ImportUnread,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "place",
      args: () => ({
        examId: Id("exams"),
        questions: Schema.Array(ImportedQuestion).check(
          Schema.isMaxLength(MAX_IMPORTED_QUESTIONS)
        ),
      }),
      returns: () => ImportPlaced,
      error: () => Schema.Union([DocumentTooLarge, ExamFrozen, ExamFull]),
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
