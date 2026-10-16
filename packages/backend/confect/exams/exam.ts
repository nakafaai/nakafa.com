import { DeliveryLanguageSchema } from "@nakafa/aksara-contracts/locale";
import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { QuestionView } from "@repo/backend/confect/exams/question";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * The most characters an exam's title may hold. A title is one line of the exam
 * list and of the editor's header, so the bound keeps it short enough to read there.
 */
export const EXAM_TITLE_MAX_LENGTH = 120;

/**
 * The most questions one exam holds. Its order is one array in its row, and Convex
 * arrays hold at most 8,192 values (`convex/_generated/ai/guidelines.md`). The
 * longest school exam the research found has about 40 questions, so 200 leaves room
 * for a long exam while the row and every read of it stay small.
 */
export const MAX_EXAM_QUESTIONS = 200;

/** A school exam's title: one line of 1 to `EXAM_TITLE_MAX_LENGTH` characters, with no space at either end. */
export const ExamTitle = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(EXAM_TITLE_MAX_LENGTH)
);

/**
 * One school exam draft: its tenant, the scope that decides who may read and edit
 * it, its title and content language, and its questions in order. The order lives
 * in this one array, so a reorder is one patch. A draft is not a publication:
 * scheduling freezes it in a later lane (ADR 0031).
 */
export const examValidator = Schema.Struct({
  createdAt: Schema.Finite,
  createdBy: Id("users"),
  language: DeliveryLanguageSchema,
  questions: Schema.Array(Id("examQuestions")).check(
    Schema.isMaxLength(MAX_EXAM_QUESTIONS)
  ),
  scope: GrantScope,
  tenantId: Id("tenants"),
  title: ExamTitle,
});

/** One exam as the list shows it: its ID, its title, and its content language. */
export const ExamSummary = Schema.Struct({
  id: Id("exams"),
  language: DeliveryLanguageSchema,
  title: ExamTitle,
});

/** The summary of a stored exam. */
export const examSummary = (row: ExamsDoc) => ({
  id: row._id,
  language: row.language,
  title: row.title,
});

/** One exam with its questions in order, as the editor opens it. */
export const ExamView = Schema.Struct({
  id: Id("exams"),
  language: DeliveryLanguageSchema,
  questions: Schema.Array(QuestionView),
  title: ExamTitle,
});
