import "@tanstack/react-start/server-only";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Effect } from "effect";
import {
  PricingPrice,
  StaticPrice,
} from "@/components/marketing/about/pricing/price";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { loadSignedTryoutContent } from "@/components/tryout/content/signed";
import type { readReviewTranslators } from "@/components/tryout/review/copy.server";
import { projectTryoutReview } from "@/components/tryout/review/model";
import { TryoutReviewCheckout } from "@/components/tryout/review/upgrade";
import {
  TryoutLockedQuestionShell,
  TryoutReviewQuestionExplanation,
} from "@/components/tryout/runtime/question/shell";
import { TryoutReviewedResponse } from "@/components/tryout/runtime/response/review";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import { Link } from "@/lib/routing/link";

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
      questions: Arr.take(access.questions, count),
    });
    return yield* projectTryoutReview({
      content,
      questions: Arr.take(runtime.questions, count),
    });
  },
  Effect.catchTags({
    ContentRuntimeMissingError: () => Effect.succeed([]),
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
  translators,
}: {
  readonly access: SignedContentAccess;
  readonly attemptId: Id<"tryoutAttempts">;
  readonly runtime: TryoutSectionRuntime;
  /** The try-out and pricing translators of the page's locale, read while the preview loads. */
  readonly translators: ReturnType<typeof readReviewTranslators>;
}) {
  const [[t, tPricing], preview] = await Promise.all([
    translators,
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
        {Arr.map(preview, (question) => (
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

      {/*
       * The Pro offer, drawn as the pricing page draws the Pro plan: a card in
       * the brand ring with the price, both actions side by side, and the hint
       * beneath them. The actions stack only when large text leaves no room for
       * both. It rises as a bottom sheet on phones and sits centered from the
       * medium breakpoint up.
       */}
      <Card className="relative w-full shadow-lg/5 ring-2 ring-primary max-md:rounded-t-2xl max-md:rounded-b-none md:max-w-md">
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
        <CardFooter className="grid gap-3 pb-[env(safe-area-inset-bottom,0px)]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(36)),1fr))] gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/$locale/pricing"
            >
              {t("paywall-compare")}
            </Link>
            <TryoutReviewCheckout />
          </div>
          <p className="text-center text-muted-foreground text-sm">
            {t("paywall-footer")}
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
