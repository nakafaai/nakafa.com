import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type SetAttemptPage = Extract<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.attemptPage.getSet>
  >,
  { kind: "current" | "retained" }
>;

type BootstrapState = SetAttemptPage["initialState"];

export type TryoutAttemptState = FunctionReturnType<
  typeof api.tryouts.queries.runtime.getSetAttemptState
>;

/** Aligns a bootstrap validator's optional response field with live state. */
export function normalizeTryoutAttemptState(
  state: BootstrapState
): NonNullable<TryoutAttemptState> {
  if (!state.runtime) {
    return { attempt: state.attempt, runtime: null };
  }

  return {
    attempt: state.attempt,
    runtime: {
      ...state.runtime,
      questions: state.runtime.questions.map((question) => ({
        ...question,
        response: question.response
          ? {
              answeredAt: question.response.answeredAt,
              selectedOptionId: question.response.selectedOptionId,
              updatedAt: question.response.updatedAt,
            }
          : null,
      })),
    },
  };
}
