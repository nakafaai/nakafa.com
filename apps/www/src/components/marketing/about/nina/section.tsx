import {
  Reasoning,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { MarkdownContent } from "@repo/design-system/components/markdown/content";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@repo/design-system/components/ui/message";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { NinaPrompt } from "@/components/ai/message/prompt";
import {
  MessageSection,
  MessageSections,
} from "@/components/ai/message/section";
import { NinaComposer } from "@/components/marketing/about/nina/client";
import { NINA_SLOT } from "@/components/marketing/about/toys/slot";
import {
  TurnAnswer,
  TurnAsk,
  TurnPlayer,
  TurnReveal,
} from "@/components/marketing/about/turn.client";
import {
  FeatureCard,
  FeatureLead,
  FeatureRow,
  FeatureText,
  FeatureTitle,
} from "@/components/marketing/shared/feature";

/** The id of Nina's answer, shared by its server copy and the chat's Response. */
const ANSWER_ID = "home-nina-answer";

/**
 * The Nina row: its words beside a card of Nina's real chat, a finished turn
 * built from the chat's own messages, sections and parts. A turn about the
 * try-out question above plays once the row is on screen: the learner's question
 * is typed into its bubble, then the reasoning row and the answer come in. Under
 * it is her real message box: what the visitor types there opens a new chat with
 * her.
 */
export function NinaSection() {
  const t = useTranslations("Landing");
  const ask = t("nina-chat-ask");
  const answer = t("nina-chat-answer");

  return (
    <FeatureRow id="nina">
      <FeatureText>
        <span className="inline-block" id={NINA_SLOT.nina}>
          <Nina act="typing" label="" size={88} whole />
        </span>
        <FeatureTitle>{t("nina-title")}</FeatureTitle>
        <FeatureLead>{t("nina-lead")}</FeatureLead>
      </FeatureText>
      <FeatureCard>
        <TurnPlayer>
          <Message align="end">
            <NinaPrompt>
              <TurnAsk text={ask} />
            </NinaPrompt>
          </Message>
          <Message>
            <MessageContent className="gap-6">
              <div className="flex min-w-0 flex-col gap-4">
                <TurnReveal>
                  <MessageSections>
                    <MessageSection kind="activity">
                      {/* The turn's reasoning has no text, so its row shows no content. */}
                      <Reasoning
                        className="w-full"
                        defaultOpen={false}
                        hasContent={false}
                      >
                        <ReasoningTrigger />
                      </Reasoning>
                    </MessageSection>
                    <MessageSection kind="response">
                      <TurnAnswer id={ANSWER_ID} text={answer}>
                        <MarkdownContent id={ANSWER_ID} variant="chat">
                          {answer}
                        </MarkdownContent>
                      </TurnAnswer>
                    </MessageSection>
                  </MessageSections>
                </TurnReveal>
                {/* The row that a finished chat turn keeps under its answer, so
                    this card has the same height. Its actions are the owner's
                    and never show here. */}
                <MessageFooter className="min-h-9 justify-between gap-4" />
              </div>
            </MessageContent>
          </Message>
        </TurnPlayer>
        <NinaComposer />
      </FeatureCard>
    </FeatureRow>
  );
}
