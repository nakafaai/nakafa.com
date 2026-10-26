import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option } from "effect";
import { NinaAskProvider } from "@/components/ai/ask";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { TryoutAskButton } from "@/components/tryout/review/ask";
import { readReviewTranslators } from "@/components/tryout/review/copy.server";
import { TryoutReviewLocked } from "@/components/tryout/review/locked";
import { projectTryoutReview } from "@/components/tryout/review/model";
import {
  TryoutReviewQuestionExplanation,
  TryoutReviewQuestionShell,
} from "@/components/tryout/runtime/question/shell";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import { scheduleCurrentServerExceptionCapture } from "@/lib/analytics/exception.server";
import { runServerEffect } from "@/lib/server/fn";

/**
 * Loads the signed content of one terminal review and projects its questions.
 * A projection that fails closed is reported with its cause and yields none, so
 * the screen asks for a refresh.
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
      Effect.asSome,
      Effect.catchTag("TryoutReviewProjectionError", (error) =>
        scheduleCurrentServerExceptionCapture(error, {
          source: "tryout.review",
        }).pipe(Effect.as(Option.none()))
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
        runtime={runtime}
        translators={readReviewTranslators(locale)}
      />
    );
  }
  const review = await runServerEffect(
    readTryoutReviewQuestions(attemptId, access, runtime)
  );

  if (Option.isNone(review)) {
    return <TryoutContentRefresh />;
  }

  return (
    <NinaAskProvider>
      <section className="space-y-12">
        {Arr.map(review.value, (question) => (
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
