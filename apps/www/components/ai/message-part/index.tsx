"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { MessageContent } from "@repo/design-system/components/ai/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { Response } from "@repo/design-system/components/ai/response";
import { memo } from "react";
import { SuggestionsPart } from "./suggestions";
import { WebSearchPart } from "./web-search";

type Props = {
  part: MyUIMessage["parts"][number];
  partIndex: number;
  messageId: string;
};

export const AiMessagePart = memo(({ part, partIndex, messageId }: Props) => {
  switch (part.type) {
    case "text":
      return (
        <MessageContent>
          <Response id={`${messageId}-part-${partIndex}`}>{part.text}</Response>
        </MessageContent>
      );
    case "reasoning":
      return (
        <Reasoning
          className="w-full"
          defaultOpen={false}
          isStreaming={part.state === "streaming"}
        >
          <ReasoningTrigger />
          <ReasoningContent id={`${messageId}-part-${partIndex}`}>
            {part.text}
          </ReasoningContent>
        </Reasoning>
      );
    case "data-web-search":
      return <WebSearchPart message={part.data} />;
    case "data-suggestions":
      return <SuggestionsPart message={part.data} />;
    default:
      null;
  }
});
AiMessagePart.displayName = "AiMessagePart";
