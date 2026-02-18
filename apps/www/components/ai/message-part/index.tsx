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
import { ArticlesPart } from "./articles";
import { CalculatorPart } from "./calculator";
import { ContentPart } from "./content";
import { SubjectsPart } from "./subjects";
import { SuggestionsPart } from "./suggestions";
import { WebSearchPart } from "./web-search";

interface Props {
  messageId: string;
  part: MyUIMessage["parts"][number];
  partIndex: number;
}

export const AiMessagePart = memo(({ part, partIndex, messageId }: Props) => {
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
      return <SuggestionsPart message={part.data} />;
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
