"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { MessageContent } from "@repo/design-system/components/ai/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { Response } from "@repo/design-system/components/ai/response";

import { useMessage } from "@/components/ai/context/use-message";
import { MathPart } from "@/components/ai/message-part/math";
import { NakafaPart } from "@/components/ai/message-part/nakafa";
import { ScrapeUrlPart } from "@/components/ai/message-part/scrape-url";
import { WebSearchPart } from "@/components/ai/message-part/web-search";

interface Props {
  part: MyUIMessage["parts"][number];
  partIndex: number;
}

/** Renders one typed Nina response part with its production presentation. */
export function AiMessagePart({ part, partIndex }: Props) {
  const messageId = useMessage((state) => state.message.id);

  switch (part.type) {
    case "text":
      return (
        <MessageContent>
          <Response id={`${messageId}-part-${partIndex}`}>{part.text}</Response>
        </MessageContent>
      );
    case "reasoning": {
      const hasContent = part.text.trim().length > 0;

      return (
        <Reasoning
          className="w-full"
          defaultOpen={false}
          hasContent={hasContent}
          isStreaming={part.state === "streaming"}
        >
          <ReasoningTrigger />
          {hasContent ? (
            <ReasoningContent id={`${messageId}-part-${partIndex}`}>
              {part.text}
            </ReasoningContent>
          ) : null}
        </Reasoning>
      );
    }
    case "data-web-search":
      return <WebSearchPart message={part.data} />;
    case "data-scrape-url":
      return <ScrapeUrlPart message={part.data} />;
    case "data-suggestions":
      return null;
    case "data-math":
      return <MathPart message={part.data} />;
    case "data-nakafa":
      return <NakafaPart message={part.data} />;
    default:
      return null;
  }
}
AiMessagePart.displayName = "AiMessagePart";
