import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import {
  PricingPrice,
  StaticPrice,
} from "@/components/marketing/about/pricing/price";
import type { TryoutBody } from "@/components/tryout/content/body";
import { TryoutReviewCheckout } from "@/components/tryout/review/upgrade";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import {
  TryoutLockedQuestionShell,
  TryoutReviewQuestionExplanation,
} from "@/components/tryout/runtime/question/shell";
import { TryoutResponseFields } from "@/components/tryout/runtime/response/fields";
import type { TryoutRuntimeQuestion } from "@/components/tryout/runtime/types";
import { Link } from "@/lib/routing/link";

/**
 * Shows a free learner their own leading questions with explanations under the Pro offer: the questions
 * whose keys the backend gives a free learner. The backend sends no key and no explanation for the rest,
 * so removing the veil reveals nothing beyond the preview.
 */
export function TryoutReviewLocked({
  preview,
  total,
}: {
  /** The leading questions with their bodies, keys, and explanations. */
  readonly preview: readonly {
    readonly body: TryoutBody;
    readonly question: TryoutRuntimeQuestion;
  }[];
  /** How many questions the section holds. */
  readonly total: number;
}) {
  const t = useTranslations("Tryouts");
  const tPricing = useTranslations("Pricing");

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
        {Arr.map(preview, ({ body, question }) => (
          <TryoutLockedQuestionShell
            key={question.placementId}
            questionOrder={question.questionOrder}
          >
            <section className="my-6">
              <TryoutQuestionBody body={body} />
            </section>
            <section className="my-8">
              {/* The learner's own answer is not marked here, so no choice shows a mark. */}
              <TryoutResponseFields
                value={{
                  id: question.placementId,
                  interaction: body.interaction,
                  locked: true,
                  onChange: () => undefined,
                  response: null,
                }}
              />
            </section>
            <TryoutReviewQuestionExplanation
              questionOrder={question.questionOrder}
            >
              <TryoutExplanationBody body={body} />
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
              {t("paywall-title", { count: total })}
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
