import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";
import { NinaAskProvider } from "@/components/ai/ask";
import {
  PlayerQuestionAnswer,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { TryoutReviewLocked } from "@/components/tryout/review/locked";
import { useTryoutReview } from "@/components/tryout/review/result";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutReviewedFields } from "@/components/tryout/runtime/response/review";

/**
 * The questions of the finished attempt a page was loaded with, in the review's player
 * (`TryoutReviewFrame`): each with its body, the learner's answer marked against the key, and its
 * explanation, in the list or one at a time. The backend sends a question's key and explanation only to a
 * learner who may read them, so a section whose questions do not all carry a key shows its leading
 * preview under the Pro offer.
 */
export function TryoutAttemptReview({
  binding,
}: {
  readonly binding: { readonly attemptId: Id<"tryoutAttempts"> } | null;
}) {
  const { joined, runtime, whole } = useTryoutReview();
  if (binding === null) {
    return null;
  }
  if (!whole) {
    return (
      <TryoutReviewLocked
        preview={Arr.takeWhile(joined, ({ body }) => body.key !== undefined)}
        total={runtime.questions.length}
      />
    );
  }

  return (
    <NinaAskProvider>
      <PlayerQuestions>
        {Arr.map(joined, ({ body, question }) => (
          <TryoutReviewQuestionShell
            action={
              <TryoutAskButton
                attemptId={binding.attemptId}
                placementId={question.placementId}
                questionOrder={question.questionOrder}
              />
            }
            key={question.placementId}
            questionKey={question.placementId}
            questionOrder={question.questionOrder}
          >
            <PlayerQuestionPrompt>
              <TryoutQuestionBody body={body} />
            </PlayerQuestionPrompt>
            <PlayerQuestionAnswer>
              {body.key === undefined ? null : (
                <TryoutReviewedFields
                  answer={body.key}
                  id={`review-${question.placementId}`}
                  interaction={body.interaction}
                  response={question.response?.response ?? null}
                />
              )}
            </PlayerQuestionAnswer>
            <TryoutReviewQuestionExplanation
              questionOrder={question.questionOrder}
            >
              <TryoutExplanationBody body={body} />
            </TryoutReviewQuestionExplanation>
          </TryoutReviewQuestionShell>
        ))}
      </PlayerQuestions>
    </NinaAskProvider>
  );
}
