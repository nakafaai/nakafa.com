import type { Grade } from "@repo/backend/confect/assessment/grade";
import { judgeMath } from "@repo/backend/confect/assessment/math/judge";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { typedText } from "@repo/backend/confect/assessment/response";
import { Option } from "effect";

/**
 * The grade of a typed expression against its key's expression, as practice and consumer try-outs score
 * a math entry (ADR 0031, section 3, and the exam profile's `sampledMath: "score"`): a `proven` or a
 * `sampled` answer earns the ceiling, and `none` earns nothing, so every answer is scored the moment it
 * is given. A key whose expression the grader cannot read waits for a person instead of marking every
 * learner wrong. A School exam sends a sampled answer to its teacher (`sampledMath: "review"`); School
 * has no math entry template, so none of its questions reaches this.
 */
export const scoreMath = (
  expression: string,
  response: ExamResponse,
  ceiling: number
): Grade =>
  Option.match(judgeMath(expression, typedText(response)), {
    onNone: (): Grade => ({ ceiling, status: "pending" }),
    onSome: (outcome): Grade => ({
      category: outcome === "none" ? 0 : ceiling,
      ceiling,
      status: "scored",
    }),
  });
