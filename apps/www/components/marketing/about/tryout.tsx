import { useTranslations } from "next-intl";
import { Talk } from "@/components/marketing/about/talk.client";
import {
  TryoutDemo,
  TryoutDemoQuestion,
  TryoutDemoReply,
} from "@/components/marketing/about/tryout/demo.client";
import type { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { renderTryoutResponseLabels } from "@/components/tryout/runtime/response/labels";

/** The featured question and its response, as the catalog reads them. */
type FeaturedTryout = Awaited<ReturnType<typeof readFeaturedTryout>>;

/**
 * The practice test row: a real question with its real choices on one side,
 * which answers itself once it is on screen, and a short talk with Nina on the
 * other, whose answer follows the question's. On a phone the talk comes first.
 */
export function Tryout({ value }: { value: FeaturedTryout }) {
  const t = useTranslations("Landing");
  const responseId = "home-tryout-response";

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="tryout">
      <TryoutDemo>
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
          <div className="grid min-w-0 content-center gap-8">
            <Talk ask={t("tryout-ask")}>
              <TryoutDemoReply
                words={{
                  right: t("tryout-right"),
                  waiting: t("tryout-answer"),
                  wrong: t("tryout-wrong"),
                }}
              />
            </Talk>
            <div className="grid gap-2">
              <h2 className="text-balance text-2xl tracking-tight">
                {t("tryout-title")}
              </h2>
              <p className="max-w-md text-pretty text-base text-muted-foreground">
                {t("tryout-lead")}
              </p>
            </div>
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
    </section>
  );
}
