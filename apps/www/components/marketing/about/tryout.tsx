import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { useTranslations } from "next-intl";
import { NinaPrompt } from "@/components/ai/message/prompt";
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
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <div className="grid gap-4">
            <Message align="end">
              <NinaPrompt text={t("tryout-ask")} />
            </Message>
            <Message>
              <MessageContent>
                <MarkdownContent id="home-tryout-answer" variant="chat">
                  {t("tryout-answer")}
                </MarkdownContent>
              </MessageContent>
            </Message>
          </div>
          <div className="grid gap-3">
            <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
              {t("tryout-title")}
            </h2>
            <p className="max-w-xl text-pretty text-base text-muted-foreground">
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
