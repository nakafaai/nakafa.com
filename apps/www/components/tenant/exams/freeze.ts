import type { ExamView } from "@/components/tenant/exams/optimistic";

/**
 * Whether a sitting of the exam is scheduled, so its questions, their order, their keys, and their
 * prompts cannot change (ADR 0031). The server refuses each such change as `ExamFrozen`, and the
 * editor reads the same field to show the exam read-only.
 */
export const isFrozen = (exam: Pick<ExamView, "frozenAt">) =>
  exam.frozenAt !== undefined;
