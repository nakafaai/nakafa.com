import { useTranslations } from "next-intl";
import {
  TryoutDemo,
  TryoutDemoNina,
  TryoutDemoQuestion,
  TryoutDemoReply,
} from "@/components/marketing/about/tryout/demo.client";
import { Turn } from "@/components/marketing/about/turn";
import { MarketingSection } from "@/components/marketing/shared/section";
import type { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { renderTryoutResponseLabels } from "@/components/tryout/runtime/response/labels";

/** The featured question and its response, as the catalog reads them. */
type FeaturedTryout = Awaited<ReturnType<typeof readFeaturedTryout>>;

/**
 * The practice test row: a real question with its real choices on one side,
 * which answers itself once it is on screen, and one turn of Nina's chat on the
 * other, whose answer follows the question's. On a phone the turn comes first.
 */
export function Tryout({ value }: { value: FeaturedTryout }) {
  const t = useTranslations("Landing");
  const responseId = "home-tryout-response";

  return (
    <MarketingSection id="tryout">
      <TryoutDemo>
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="grid min-w-0 content-center gap-8">
            <div className="grid gap-2">
              <TryoutDemoNina />
              <h2 className="text-balance text-2xl tracking-tight">
                {t("tryout-title")}
              </h2>
              <p className="max-w-md text-pretty text-base text-muted-foreground">
                {t("tryout-lead")}
              </p>
            </div>
            <Turn ask={t("tryout-ask")}>
              <TryoutDemoReply
                words={{
                  right: t("tryout-right"),
                  waiting: t("tryout-answer"),
                  wrong: t("tryout-wrong"),
                }}
              />
            </Turn>
          </div>
          <div className="min-w-0 lg:order-first">
            <section className="my-6">{value.question}</section>
            <section className="my-8">
              <TryoutDemoQuestion
                id={responseId}
                labels={renderTryoutResponseLabels(responseId, value.response)}
                responseSpec={value.response}
              />
            </section>
          </div>
        </div>
      </TryoutDemo>
    </MarketingSection>
  );
}
