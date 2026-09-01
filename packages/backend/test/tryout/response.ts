import {
  type QuestionResponse,
  QuestionResponseSchema,
} from "@nakafa/aksara-contracts/question/response";

/** Creates one valid published single-choice response for test placements. */
export function makeTestQuestionResponse(
  correctLabel = "A",
  distractorLabel = "B"
): QuestionResponse {
  return QuestionResponseSchema.make({
    kind: "single-choice",
    options: [
      {
        isCorrect: true,
        label: correctLabel,
        optionKey: "option-1",
        order: 1,
      },
      {
        isCorrect: false,
        label: distractorLabel,
        optionKey: "option-2",
        order: 2,
      },
    ],
  });
}
