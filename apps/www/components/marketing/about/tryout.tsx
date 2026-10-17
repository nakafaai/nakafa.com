import { useTranslations } from "next-intl";
import { Talk, TalkReply } from "@/components/marketing/about/talk.client";
import type { readFeaturedTryout } from "@/components/tryout/catalog/server";
import { renderTryoutResponseLabels } from "@/components/tryout/runtime/response/labels";
import { TryoutResponsePreview } from "@/components/tryout/runtime/response/preview.client";

/** The featured question and its response, as the catalog reads them. */
type FeaturedTryout = Awaited<ReturnType<typeof readFeaturedTryout>>;

/**
 * The practice test row: a real question with its real choices and response
 * on one side, and a short chat with Nina on the other. On a phone the chat
 * comes first.
 */
export function Tryout({ value }: { value: FeaturedTryout }) {
  const t = useTranslations("Landing");
  const responseId = "home-tryout-response";

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="tryout">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <Talk ask={t("tryout-ask")}>
            <TalkReply act="drumming" mood="winking">
              {t("tryout-answer")}
            </TalkReply>
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
            <TryoutResponsePreview
              id={responseId}
              labels={renderTryoutResponseLabels(responseId, value.response)}
              responseSpec={value.response}
            />
          </section>
        </div>
      </div>
    </section>
  );
}
