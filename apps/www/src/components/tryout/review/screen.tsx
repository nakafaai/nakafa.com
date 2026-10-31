import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import { use } from "react";
import { NinaAskProvider } from "@/components/ai/ask";
import { joinTryoutBodies } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { TryoutReviewLocked } from "@/components/tryout/review/locked";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutReviewedFields } from "@/components/tryout/runtime/response/review";
import type {
  TryoutSectionAttempt,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";

/**
 * The review of the attempt a page was loaded with, once that attempt has ended: each question with its
 * body, the learner's answer marked against the key, and its explanation. A running attempt shows its
 * player instead, and an attempt without a runtime has no review. The backend sends a question's key and
 * explanation only to a learner who may read them, so a section whose questions do not all carry a key
 * shows the free preview under the Pro offer. A page whose bodies do not cover the section asks for a
 * refresh.
 */
export function TryoutAttemptReview({
  binding,
}: {
  readonly binding: {
    readonly attemptId: Id<"tryoutAttempts">;
    readonly initialState: {
      readonly attempt: Pick<TryoutSectionAttempt, "status">;
      readonly runtime: TryoutSectionRuntime | null;
    };
  } | null;
}) {
  const value = use(TryoutContentContext);
  const runtime = binding?.initialState.runtime ?? null;
  if (
    binding === null ||
    runtime === null ||
    binding.initialState.attempt.status === "in-progress"
  ) {
    return null;
  }
  const { attemptId } = binding;
  const joined = Option.flatMap(Option.fromNullishOr(value?.bodies), (bodies) =>
    joinTryoutBodies(bodies, runtime.questions)
  );
  if (Option.isNone(joined)) {
    return <TryoutContentRefresh />;
  }
  const answered = Arr.takeWhile(
    joined.value,
    ({ body }) => body.key !== undefined
  );
  if (answered.length < joined.value.length) {
    return (
      <TryoutReviewLocked preview={answered} total={runtime.questions.length} />
    );
  }

  return (
    <NinaAskProvider>
      <section className="space-y-12">
        {Arr.map(joined.value, ({ body, question }) => (
          <TryoutReviewQuestionShell
            action={
              <TryoutAskButton
                attemptId={attemptId}
                placementId={question.placementId}
                questionOrder={question.questionOrder}
              />
            }
            key={question.placementId}
            questionOrder={question.questionOrder}
          >
            <section className="my-6">
              <TryoutQuestionBody body={body} />
            </section>
            <section className="my-8">
              {body.key === undefined ? null : (
                <TryoutReviewedFields
                  answer={body.key}
                  id={`review-${question.placementId}`}
                  interaction={body.interaction}
                  response={question.response?.response ?? null}
                />
              )}
            </section>
            <TryoutReviewQuestionExplanation
              questionOrder={question.questionOrder}
            >
              <TryoutExplanationBody body={body} />
            </TryoutReviewQuestionExplanation>
          </TryoutReviewQuestionShell>
        ))}
      </section>
    </NinaAskProvider>
  );
}
