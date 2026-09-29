import "server-only";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";
import { NinaAskProvider } from "@/components/ai/ask";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { TryoutReviewLocked } from "@/components/tryout/review/locked";
import { projectTryoutReview } from "@/components/tryout/review/model";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell.client";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/** Renders one immutable terminal review outside the active runtime Module. */
export async function TryoutReview({
  access,
  attemptId,
  runtime,
}: {
  readonly access: SignedContentAccess;
  readonly attemptId: Id<"tryoutAttempts">;
  readonly runtime: TryoutSectionRuntime;
}) {
  if (access.answers.length === 0 && runtime.questions.length > 0) {
    return (
      <TryoutReviewLocked
        access={access}
        attemptId={attemptId}
        runtime={runtime}
      />
    );
  }
  const resolvedContent = await Effect.runPromise(
    loadSignedTryoutContent(attemptId, access)
  );
  const questions = await Effect.runPromise(
    projectTryoutReview({
      content: resolvedContent,
      questions: runtime.questions,
    }).pipe(
      Effect.catchTag("TryoutReviewProjectionError", () =>
        Effect.logWarning(
          "Terminal try-out review projection failed closed."
        ).pipe(Effect.as(null))
      )
    )
  );

  if (!questions) {
    return <TryoutContentRefresh />;
  }

  return (
    <NinaAskProvider>
      <section className="space-y-12">
        {questions.map((question) => (
          <TryoutReviewQuestionShell
            action={
              <TryoutAskButton
                attemptId={attemptId}
                placementId={question.placementId}
                questionOrder={question.questionOrder}
              />
            }
            key={question.questionOrder}
            questionOrder={question.questionOrder}
          >
            <section className="my-6">{question.content}</section>
            <section className="my-8">
              <TryoutReviewedResponse
                questionOrder={question.questionOrder}
                responseSpec={question.responseSpec}
                selection={question.response?.selection ?? null}
              />
            </section>
            <TryoutReviewQuestionExplanation
              questionOrder={question.questionOrder}
            >
              {question.answer}
            </TryoutReviewQuestionExplanation>
          </TryoutReviewQuestionShell>
        ))}
      </section>
    </NinaAskProvider>
  );
}
