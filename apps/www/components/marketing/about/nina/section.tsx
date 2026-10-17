import {
  Reasoning,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { useTranslations } from "next-intl";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { NinaComposer } from "@/components/marketing/about/nina/client";
import { Talk, TalkReply } from "@/components/marketing/about/talk.client";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * The Nina row: the learner says which question still confuses them, Nina
 * answers, and beside them is her real chat. It holds a finished turn about the
 * try-out question above, with the product's own prompt, reasoning row and
 * answer, then her real message box: what the visitor types there opens a new
 * chat with her.
 */
export function NinaSection() {
  const t = useTranslations("Landing");

  return (
    <MarketingSection id="nina">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <div className="grid gap-2">
            <h2 className="text-balance text-2xl tracking-tight">
              {t("nina-title")}
            </h2>
            <p className="max-w-md text-pretty text-base text-muted-foreground">
              {t("nina-lead")}
            </p>
          </div>
          <Talk ask={t("nina-ask")}>
            <TalkReply act="drumming" mood="happy">
              {t("nina-answer")}
            </TalkReply>
          </Talk>
        </div>
        <div className="grid min-w-0 gap-6">
          <Message align="end">
            <NinaPrompt text={t("nina-chat-ask")} />
          </Message>
          <Message>
            <MessageContent>
              <Reasoning
                className="w-full"
                defaultOpen={false}
                hasContent={false}
              >
                <ReasoningTrigger />
              </Reasoning>
              <MarkdownContent id="home-nina-answer" variant="chat">
                {t.raw("nina-chat-answer")}
              </MarkdownContent>
            </MessageContent>
          </Message>
          <NinaComposer />
        </div>
      </div>
    </MarketingSection>
  );
}
