import {
  Reasoning,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "next-intl";
import { NinaPrompt } from "@/components/ai/message/prompt";
import { NinaComposer } from "@/components/marketing/about/nina/client";
import {
  TurnAnswer,
  TurnAsk,
  TurnPlayer,
} from "@/components/marketing/about/turn.client";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * The Nina row: the row's title beside Nina's real chat, drawn with the chat's
 * own parts. A turn about the try-out question above plays once the row is on
 * screen: the learner's question is typed into its bubble, then the reasoning
 * row and the answer come in. Under it is her real message box: what the
 * visitor types there opens a new chat with her.
 */
export function NinaSection() {
  const t = useTranslations("Landing");

  return (
    <MarketingSection id="nina">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="grid min-w-0 content-center gap-8">
          <div className="grid gap-2">
            <Nina act="typing" label="" size={88} whole />
            <h2 className="text-balance text-2xl tracking-tight">
              {t("nina-title")}
            </h2>
            <p className="max-w-md text-pretty text-base text-muted-foreground">
              {t("nina-lead")}
            </p>
          </div>
        </div>
        <div className="grid min-w-0 gap-6">
          <TurnPlayer ask={t("nina-chat-ask")}>
            <Message align="end">
              <NinaPrompt>
                <TurnAsk />
              </NinaPrompt>
            </Message>
            <Message>
              <MessageContent className="gap-6">
                <TurnAnswer>
                  <div className="grid gap-6">
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
                  </div>
                </TurnAnswer>
              </MessageContent>
            </Message>
          </TurnPlayer>
          <NinaComposer />
        </div>
      </div>
    </MarketingSection>
  );
}
