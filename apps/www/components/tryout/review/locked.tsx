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
      className="relative isolate -mx-6 -mb-6 flex flex-1 flex-col justify-end overflow-hidden md:min-h-104 md:items-center md:justify-center md:p-6"
      data-slot="tryout-review-locked"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 select-none space-y-12 px-6 pt-1"
        inert
      >
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

      {/*
       * The section fills the page below the result and ends at the screen
       * edge, so nothing scrolls; the offer in flow sets its smallest height.
       * One blur covers the whole preview, and the page background rises from
       * the bottom until the preview melts into it.
       */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-5% from-background via-35% via-background/75 to-80% to-background/0 backdrop-blur-[2px]"
      />

      <TryoutReviewOffer
        compare={t("paywall-compare")}
        description={t("paywall-description")}
        period={tPricing("pro-period")}
        title={t("paywall-title", { count: runtime.questions.length })}
      />
    </section>
  );
}

/**
 * The Pro offer: a bottom sheet with the drawer's anatomy on phones and a
 * centered dialog card from the medium breakpoint up.
 */
function TryoutReviewOffer({
  compare,
  description,
  period,
  title,
}: {
  readonly compare: string;
  readonly description: string;
  readonly period: string;
  readonly title: string;
}) {
  return (
    <CardSection className="relative w-full shadow-lg/5 max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-t max-md:ring-0 md:max-w-md">
      <CardHeader>
        <CardTitle>
          <h2 id="tryout-review-offer">{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <PricingPrice Price={StaticPrice} period={period} plan="pro" />
      </CardContent>
      <CardSectionFooter className="flex-col-reverse items-stretch gap-2 max-md:rounded-none max-md:pb-[calc(env(safe-area-inset-bottom,0px)+--spacing(3))] md:flex-row md:justify-end">
        <IntentLink
          className={buttonVariants({ variant: "outline" })}
          href="/pricing"
        >
          {compare}
        </IntentLink>
        <TryoutReviewCheckout />
      </CardSectionFooter>
    </CardSection>
  );
}
