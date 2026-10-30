import type { ExamsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { GrantScope } from "@repo/backend/confect/access/schema";
import { QuestionView } from "@repo/backend/confect/exams/question";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * The most characters an exam's title may hold. A character is a Unicode code point,
 * as in `users/bio.ts`, so an emoji counts once. A title is one line of the exam list
 * and of the editor's header, so the bound keeps it short enough to read there.
 */
export const EXAM_TITLE_MAX_LENGTH = 120;

/**
 * The most questions one exam holds. Its order is one array in its row, and Convex
 * arrays hold at most 8,192 values (`convex/_generated/ai/guidelines.md`), so the bound
 * keeps the row and every read of the exam small. The value is a design choice of this
 * slice, not a measured length of school exams.
 */
export const MAX_EXAM_QUESTIONS = 200;

/** A school exam's title: one line of 1 to `EXAM_TITLE_MAX_LENGTH` characters, with no space at either end. */
export const ExamTitle = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxCodePoints(EXAM_TITLE_MAX_LENGTH)
);

/**
 * One school exam draft: its tenant, the scope that decides who may read and edit
 * it, its title, and its questions in order. The order lives in this one array, so a
 * reorder is one patch. It takes changes while a sitting is scheduled and while it runs; the
 * first sitting that finishes freezes it, and `frozenAt` records when (ADR 0031).
 */
export const examValidator = Schema.Struct({
  createdAt: Schema.Finite,
  createdBy: Id("users"),
  /** When the first sitting of the exam finished. From then on its questions, their order, and their keys cannot change. */
  frozenAt: Schema.optionalKey(Schema.Finite),
  questions: Schema.Array(Id("examQuestions")).check(
    Schema.isMaxLength(MAX_EXAM_QUESTIONS)
  ),
  scope: GrantScope,
  tenantId: Id("tenants"),
  title: ExamTitle,
});

/** One exam as the list shows it: its ID and its title. */
export const ExamSummary = Schema.Struct({
  id: Id("exams"),
  title: ExamTitle,
});

/** The summary of a stored exam. */
export const examSummary = (row: ExamsDoc) => ({
  id: row._id,
  title: row.title,
});

/**
 * One exam as the exam list shows it: its summary, when it was created, how many questions it holds, and where it
 * belongs, the whole school or one unit.
 */
export const ExamListed = Schema.Struct({
  ...ExamSummary.fields,
  createdAt: Schema.Finite,
  questionCount: Schema.Int,
  scope: GrantScope,
});

/** A stored exam as the exam list shows it. */
export const examListed = (row: ExamsDoc) => ({
  ...examSummary(row),
  createdAt: row.createdAt,
  questionCount: row.questions.length,
  scope: row.scope,
});

/**
 * One exam with its questions in order, as the editor opens it. `frozenAt` is present once a
 * sitting of the exam has finished, so the editor shows the exam read-only (ADR 0031).
 * `archived` is true while the unit that holds the exam is archived, which locks its edits.
 */
export const ExamView = Schema.Struct({
  archived: Schema.Boolean,
  frozenAt: examValidator.fields.frozenAt,
  id: Id("exams"),
  questions: Schema.Array(QuestionView),
  title: ExamTitle,
});
