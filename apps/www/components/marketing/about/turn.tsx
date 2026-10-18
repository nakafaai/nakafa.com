import {
  Message,
  MessageContent,
} from "@repo/design-system/components/ui/message";
import type { ReactNode } from "react";
import { NinaPrompt } from "@/components/ai/message/prompt";
import {
  TurnAnswer,
  TurnAsk,
  TurnPlayer,
} from "@/components/marketing/about/turn.client";

/**
 * One turn of Nina's chat beside a row, drawn with the chat's own parts: the
 * learner's prompt in its bubble, then Nina's answer as the chat renders it.
 * The page passes the answer as `children`, already rendered by the chat's
 * Markdown parts, so no Markdown code reaches the browser.
 */
export function Turn({ ask, children }: { ask: string; children: ReactNode }) {
  return (
    <TurnPlayer ask={ask}>
      <Message align="end">
        <NinaPrompt>
          <TurnAsk />
        </NinaPrompt>
      </Message>
      <Message>
        <MessageContent>
          <TurnAnswer>{children}</TurnAnswer>
        </MessageContent>
      </Message>
    </TurnPlayer>
  );
}
