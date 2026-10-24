import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect } from "effect";
import { NinaAskProvider } from "@/components/ai/ask";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { TryoutReviewLocked } from "@/components/tryout/review/locked";
import { projectTryoutReview } from "@/components/tryout/review/model";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import { runServerEffect } from "@/lib/server/fn";

/**
 * Loads the signed content of one terminal review and projects its questions.
 * A projection that fails closed yields null, so the screen asks for a refresh.
 */
const readTryoutReviewQuestions = Effect.fn("TryoutReview.readQuestions")(
  function* (
    attemptId: Id<"tryoutAttempts">,
    access: SignedContentAccess,
    runtime: TryoutSectionRuntime
  ) {
    const content = yield* loadSignedTryoutContent(attemptId, access);
    return yield* projectTryoutReview({
      content,
      questions: runtime.questions,
    }).pipe(
      Effect.catchTag("TryoutReviewProjectionError", () =>
        Effect.logWarning(
          "Terminal try-out review projection failed closed."
        ).pipe(Effect.as(null))
      )
    );
  }
);

/** Renders one immutable terminal review outside the active runtime Module. */
export async function TryoutReview({
  access,
  attemptId,
  locale,
  runtime,
}: {
  readonly access: SignedContentAccess;
  readonly attemptId: Id<"tryoutAttempts">;
  readonly locale: Locale;
  readonly runtime: TryoutSectionRuntime;
}) {
  if (access.answers.length === 0 && runtime.questions.length > 0) {
    return (
      <TryoutReviewLocked
        access={access}
        attemptId={attemptId}
        locale={locale}
        runtime={runtime}
      />
    );
  }
  const questions = await runServerEffect(
    readTryoutReviewQuestions(attemptId, access, runtime)
  );

  if (!questions) {
    return <TryoutContentRefresh />;
  }

  return (
    <NinaAskProvider>
      <section className="space-y-12">
        {Arr.map(questions, (question) => (
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
