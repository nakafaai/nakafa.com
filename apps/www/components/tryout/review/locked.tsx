import "server-only";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
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
import { projectTryoutPreview } from "@/components/tryout/review/model";
import { TryoutReviewCheckout } from "@/components/tryout/review/upgrade.client";
import {
  TryoutLockedQuestionShell,
  TryoutReviewQuestionExplanation,
} from "@/components/tryout/runtime/question/shell.client";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

const PREVIEW_QUESTIONS = 2;

/** Loads only question bodies; the offer stays usable without its preview. */
const loadPreview = Effect.fn("TryoutReview.loadPreview")(
  function* (
    attemptId: Id<"tryoutAttempts">,
    access: SignedContentAccess,
    runtime: TryoutSectionRuntime
  ) {
    const content = yield* loadSignedTryoutContent(attemptId, {
      ...access,
      answers: [],
      questions: access.questions.slice(0, PREVIEW_QUESTIONS),
    });
    return yield* projectTryoutPreview({
      content,
      questions: runtime.questions.slice(0, PREVIEW_QUESTIONS),
    });
  },
  Effect.catchTags({
    ContentRuntimeVerificationError: () => Effect.succeed([]),
    TryoutReviewProjectionError: () => Effect.succeed([]),
  })
);

/**
 * Shows a free learner their own first questions behind the Pro offer. The
 * server never loads answers here, so removing the overlay reveals nothing new.
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
        className="pointer-events-none h-136 select-none overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_1.5rem,black_55%,transparent)] sm:h-152"
        inert
      >
        <div className="space-y-12 blur-[2px]">
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
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </TryoutReviewQuestionExplanation>
            </TryoutLockedQuestionShell>
          ))}
        </div>
      </div>

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
