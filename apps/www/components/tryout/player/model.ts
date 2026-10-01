import type { PlayerQuestion } from "@/components/player/context";
import type { PlayerMode } from "@/components/player/mode";
import type { PlayerSelection } from "@/components/player/response";
import type { TryoutFinishActions } from "@/components/tryout/player/finish.client";
import type {
  TryoutRuntimeQuestion,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

/** What a live attempt page hands the try-out player. */
export interface TryoutPlayerInput {
  readonly finish: TryoutFinishActions;
  readonly mode: PlayerMode;
}

/** Projects the live runtime into player questions with bound mutations. */
export function projectTryoutQuestions(input: {
  readonly answer: (
    question: TryoutRuntimeQuestion,
    selection: PlayerSelection | null
  ) => void;
  readonly flag: (question: TryoutRuntimeQuestion, flagged: boolean) => void;
  readonly runtime: TryoutSectionRuntime;
}): readonly PlayerQuestion[] {
  return input.runtime.questions.map((question) => ({
    answer: (selection) => input.answer(question, selection),
    answered: question.response?.isComplete ?? false,
    flag: (flagged) => input.flag(question, flagged),
    flagged: question.flagged,
    key: question.placementId,
    number: question.questionOrder,
    responseSpec: question.responseSpec,
    selection: question.response?.selection ?? null,
  }));
}
