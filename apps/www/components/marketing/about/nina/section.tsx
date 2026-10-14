import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { useTranslations } from "next-intl";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { NinaComposer } from "@/components/marketing/about/nina/client";

/**
 * The Nina row: a question the learner has open, Nina's reply, and her real
 * message box. The bubbles and the box are the product's own components.
 */
export function NinaSection() {
  const t = useTranslations("Landing");

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="nina">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <Message align="end">
            <NinaPrompt text={t("nina-ask")} />
          </Message>
          <div className="grid gap-3">
            <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
              {t("nina-title")}
            </h2>
            <p className="max-w-xl text-pretty text-base text-muted-foreground">
              {t("nina-lead")}
            </p>
          </div>
        </div>
        <div className="grid min-w-0 gap-6">
          <Message>
            <MessageContent>
              <MarkdownContent id="home-nina-answer" variant="chat">
                {t("nina-answer")}
              </MarkdownContent>
            </MessageContent>
          </Message>
          <NinaComposer />
        </div>
      </div>
    </section>
  );
}
