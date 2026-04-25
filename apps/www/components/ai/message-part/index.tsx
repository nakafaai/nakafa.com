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
import { useMessage } from "@/components/ai/context/use-message";
import { ArticlesPart } from "@/components/ai/message-part/articles";
import { CalculatorPart } from "@/components/ai/message-part/calculator";
import { ContentPart } from "@/components/ai/message-part/content";
import { SubjectsPart } from "@/components/ai/message-part/subjects";
import { WebSearchPart } from "@/components/ai/message-part/web-search";

interface Props {
  part: MyUIMessage["parts"][number];
  partIndex: number;
}

export const AiMessagePart = memo(({ part, partIndex }: Props) => {
  const messageId = useMessage((state) => state.message.id);

  switch (part.type) {
    case "text":
      return (
        <MessageContent>
          <Response id={`${messageId}-part-${partIndex}`}>{part.text}</Response>
        </MessageContent>
      );
    case "reasoning":
      if (part.state === "done" && !part.text) {
        return null;
      }

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
      return null;
    case "data-calculator":
      return <CalculatorPart message={part.data} />;
    case "data-get-content":
      return <ContentPart message={part.data} />;
    case "data-get-subjects":
      return <SubjectsPart message={part.data} />;
    case "data-get-articles":
      return <ArticlesPart message={part.data} />;
    default:
      return null;
  }
});
AiMessagePart.displayName = "AiMessagePart";
