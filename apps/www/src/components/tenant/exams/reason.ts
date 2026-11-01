import { REASON_ID } from "@repo/backend/confect/exams/scoring";
import type { Question } from "@/components/tenant/exams/optimistic";

/** The name of a choice on its paper: its place in an answer and its reason, and none in a question of one choice. */
export const choiceTitle = (
  template: Question["template"],
  choiceId: string
) => {
  if (template !== "reason") {
    return null;
  }
  return choiceId === REASON_ID ? "reason-title" : "reason-answer";
};
