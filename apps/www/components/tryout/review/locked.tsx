import "server-only";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Effect } from "effect";
import { getTranslations } from "next-intl/server";
import {
  PricingPrice,
  StaticPrice,
} from "@/components/marketing/about/pricing/price";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import { projectTryoutReview } from "@/components/tryout/review/model";
import { TryoutReviewCheckout } from "@/components/tryout/review/upgrade.client";
import {
  TryoutLockedQuestionShell,
  TryoutReviewQuestionExplanation,
} from "@/components/tryout/runtime/question/shell.client";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

/**
 * Loads the leading questions the backend previews to a free learner, with
 * their explanations; the offer stays usable without them.
 */
const loadPreview = Effect.fn("TryoutReview.loadPreview")(
  function* (
    attemptId: Id<"tryoutAttempts">,
    access: SignedContentAccess,
    runtime: TryoutSectionRuntime
  ) {
    const count = access.previewAnswers.length;
    if (count === 0) {
      return [];
    }
    const content = yield* loadSignedTryoutContent(attemptId, {
      ...access,
      answers: access.previewAnswers,
      questions: access.questions.slice(0, count),
    });
    return yield* projectTryoutReview({
      content,
      questions: runtime.questions.slice(0, count),
    });
  },
  Effect.catchTags({
    ContentRuntimeVerificationError: () => Effect.succeed([]),
    TryoutReviewProjectionError: () => Effect.succeed([]),
  })
);

/**
 * Shows a free learner their own leading questions with explanations under
 * the Pro offer. The backend authorizes only those answers, so removing the
 * veil reveals nothing beyond the preview.
 */
export async function TryoutReviewLocked({
  access,
  attemptId,
  runtime,
}: {
  readonly access: SignedContentAccess;
  readonly attemptId: Id<"tryoutAttempts">;
  readonly runtime: TryoutSectionRuntime;
}) {
  const [t, tPricing, preview] = await Promise.all([
    getTranslations("Tryouts"),
    getTranslations("Pricing"),
    Effect.runPromise(loadPreview(attemptId, access, runtime)),
  ]);

  return (
    <section
      aria-labelledby="tryout-review-offer"
      className="relative isolate"
      data-slot="tryout-review-locked"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none h-160 select-none overflow-hidden sm:h-176"
        inert
      >
        <div className="space-y-12">
          {preview.map((question) => (
            <TryoutLockedQuestionShell
              key={question.questionOrder}
              questionOrder={question.questionOrder}
            >
              <section className="my-6">{question.content}</section>
              <section className="my-8">
                {/* Correctness is not authorized here, so no choice is marked. */}
                <TryoutReviewedResponse
                  questionOrder={question.questionOrder}
                  responseSpec={question.responseSpec}
                  selection={null}
                />
              </section>
              <TryoutReviewQuestionExplanation
                questionOrder={question.questionOrder}
              >
                {question.answer}
              </TryoutReviewQuestionExplanation>
            </TryoutLockedQuestionShell>
          ))}
        </div>
      </div>

      {/*
       * The veil reaches through the article gutter so it spans the screen on
       * phones and ends in plain background elsewhere; its blur and tint fade
       * in from the top and settle into the page background at the bottom.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 inset-y-0 bg-linear-to-b from-transparent via-65% via-background/50 to-background backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,transparent,black_8rem)]"
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full max-w-md">
          <CardSection>
            <CardHeader>
              <CardTitle>
                <h2 id="tryout-review-offer">
                  {t("paywall-title", { count: runtime.questions.length })}
                </h2>
              </CardTitle>
              <CardDescription>{t("paywall-description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PricingPrice
                Price={StaticPrice}
                period={tPricing("pro-period")}
                plan="pro"
              />
            </CardContent>
            <CardSectionFooter className="flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-end">
              <IntentLink
                className={buttonVariants({ variant: "outline" })}
                href="/pricing"
              >
                {t("paywall-compare")}
              </IntentLink>
              <TryoutReviewCheckout />
            </CardSectionFooter>
          </CardSection>
        </div>
      </div>
    </section>
  );
}
