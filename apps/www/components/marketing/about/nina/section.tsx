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
import {
  FeatureCard,
  FeatureLead,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

/**
 * The Nina row: its words beside a card of Nina's real chat, drawn with the
 * chat's own parts. A turn about the try-out question above plays once the row is on
 * screen: the learner's question is typed into its bubble, then the reasoning
 * row and the answer come in. Under it is her real message box: what the
 * visitor types there opens a new chat with her.
 */
export function NinaSection() {
  const t = useTranslations("Landing");

  return (
    <FeatureRow id="nina">
      <FeatureText>
        <Nina act="typing" label="" size={88} whole />
        <FeatureTitle>{t("nina-title")}</FeatureTitle>
        <FeatureLead>{t("nina-lead")}</FeatureLead>
      </FeatureText>
      <FeatureCard>
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
      </FeatureCard>
    </FeatureRow>
  );
}
