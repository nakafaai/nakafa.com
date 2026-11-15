import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";
import { NinaAskProvider } from "@/components/ai/ask";
import {
  PlayerQuestionAnswer,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import { PlayerQuestions } from "@/components/player/questions";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { verdictOfQuestion } from "@/components/tryout/review/model";
import { TryoutExplanationOffer } from "@/components/tryout/review/offer";
import { useTryoutReview } from "@/components/tryout/review/result";
import { TryoutVerdictBadge } from "@/components/tryout/review/verdict";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import { TryoutReviewedFields } from "@/components/tryout/runtime/response/review";

/**
 * The questions of the finished attempt a page was loaded with, in the review's player
 * (`TryoutReviewFrame`), in the list or one at a time: each with its body, the learner's own answer, and
 * how it went, which every reader sees, as a score is free. The backend sends a question's key and
 * explanation only to a reader who may read them, a Pro learner or anyone on the section's free samples,
 * so such a question marks the answer against its key and opens its explanation, and any other question
 * opens the Pro offer in its explanation's place. Nina answers about any question, for the learner's Nina
 * credits.
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
            action={
              <TryoutAskButton
                attemptId={binding.attemptId}
                placementId={question.placementId}
                questionOrder={question.questionOrder}
              />
            }
            key={question.placementId}
            mark={<TryoutVerdictBadge verdict={verdictOfQuestion(question)} />}
            questionKey={question.placementId}
            questionOrder={question.questionOrder}
          >
            <PlayerQuestionPrompt>
              <TryoutQuestionBody body={body} />
            </PlayerQuestionPrompt>
            <PlayerQuestionAnswer>
              {body.key === undefined ? (
                <TryoutResponseFields
                  value={{
                    id: `review-${question.placementId}`,
                    interaction: body.interaction,
                    locked: true,
                    onChange: () => undefined,
                    response: question.response?.response ?? null,
                  }}
                />
              ) : (
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
              {body.key === undefined ? (
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
