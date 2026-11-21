import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";
import { NinaAskProvider } from "@/components/ai/ask";
import {
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { verdictOfQuestion } from "@/components/tryout/review/model";
import { TryoutExplanationOffer } from "@/components/tryout/review/offer";
import { useTryoutReview } from "@/components/tryout/review/result";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import {
  TryoutReviewQuestionActions,
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutReviewedAnswer } from "@/components/tryout/runtime/response/review";

/**
 * The questions of the finished attempt a page was loaded with, in the review's player
 * (`TryoutReviewFrame`), in the list or one at a time: each with its body, the learner's own answer, and
 * how it went, which every reader sees, as a score is free. The backend sends a question's keys and
 * explanation only to a reader who may read them, a Pro learner or anyone on the section's free samples,
 * so such a question marks the answer against its keys, shows the points of each part of a question of
 * several, and opens its explanation, and any other question opens the Pro offer in its explanation's
 * place. Nina answers about any question, for the learner's Nina credits.
 */
export function TryoutAttemptReview({
  binding,
}: {
  readonly binding: { readonly attemptId: Id<"tryoutAttempts"> } | null;
}) {
  const { joined } = useTryoutReview();
  if (binding === null) {
    return null;
  }

  return (
    <NinaAskProvider>
      <PlayerQuestions>
        {Arr.map(joined, ({ body, question }) => (
          <TryoutReviewQuestionShell
            key={question.placementId}
            questionKey={question.placementId}
            questionOrder={question.questionOrder}
          >
            <PlayerQuestionHeader
              number={question.questionOrder}
              verdict={verdictOfQuestion(question)}
            >
              <TryoutReviewQuestionActions
                questionOrder={question.questionOrder}
              >
                <TryoutAskButton
                  attemptId={binding.attemptId}
                  placementId={question.placementId}
                  questionOrder={question.questionOrder}
                />
              </TryoutReviewQuestionActions>
            </PlayerQuestionHeader>
            <PlayerQuestionPrompt>
              <TryoutQuestionBody body={body} />
            </PlayerQuestionPrompt>
            <PlayerQuestionAnswer>
              <TryoutReviewedAnswer
                grade={question.response?.grade}
                id={`review-${question.placementId}`}
                interactions={body.interactions}
                keys={body.keys}
                response={question.response?.response ?? null}
              />
            </PlayerQuestionAnswer>
            <TryoutReviewQuestionExplanation
              questionOrder={question.questionOrder}
            >
              {body.keys === undefined ? (
                <TryoutExplanationOffer />
              ) : (
                <TryoutExplanationBody body={body} />
              )}
            </TryoutReviewQuestionExplanation>
          </TryoutReviewQuestionShell>
        ))}
      </PlayerQuestions>
    </NinaAskProvider>
  );
}
