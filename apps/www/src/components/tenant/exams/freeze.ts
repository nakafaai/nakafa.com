import type { ExamView } from "@/components/tenant/exams/optimistic";

/**
 * Whether a sitting of the exam has finished, so its questions, their order, their keys, and their
 * prompts cannot change (ADR 0031). Until then the exam takes changes while it is scheduled and
 * while it runs. The server refuses each such change as `ExamFrozen`, and the editor reads the same
 * field to show the exam read-only.
 */
export const isFrozen = (exam: Pick<ExamView, "frozenAt">) =>
  exam.frozenAt !== undefined;

/**
 * Whether the editor shows the exam read-only: it is frozen, or its unit is archived, which
 * locks every edit of its exams. The server refuses each edit of a locked exam.
 */
export const isLocked = (exam: Pick<ExamView, "archived" | "frozenAt">) =>
  isFrozen(exam) || exam.archived;
