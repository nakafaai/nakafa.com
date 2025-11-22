"use client";

import type { MyUIMessage } from "@repo/ai/types/message";
import { MessageContent } from "@repo/design-system/components/ai/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { Response } from "@repo/design-system/components/ai/response";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { CheckCircle2, XCircle } from "lucide-react";
import { memo } from "react";
import { SuggestionsPart } from "@/components/finance/chat/message-part/suggestions";

type Props = {
  part: MyUIMessage["parts"][number];
  partIndex: number;
  messageId: string;
};

export const FinanceChatMessagePart = memo(
  ({ part, partIndex, messageId }: Props) => {
    switch (part.type) {
      case "text":
        return (
          <MessageContent>
            <Response id={`${messageId}-part-${partIndex}`}>
              {part.text}
            </Response>
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
      case "data-suggestions":
        return <SuggestionsPart message={part.data} />;
      case "data-create-dataset":
        return (
          <MessageContent>
            <div className="flex items-center gap-2 rounded-md border p-3">
              {part.data.status === "loading" && (
                <>
                  <SpinnerIcon className="size-4" />
                  <span className="text-sm">
                    Creating dataset for {part.data.targetRows} entities...
                  </span>
                </>
              )}
              {part.data.status === "done" && (
                <>
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span className="text-sm">
                    Dataset created successfully! Researching{" "}
                    {part.data.targetRows} entities.
                  </span>
                </>
              )}
              {part.data.status === "error" && (
                <>
                  <XCircle className="size-4 text-red-600" />
                  <span className="text-sm">
                    Error: {part.data.error || "Failed to create dataset"}
                  </span>
                </>
              )}
            </div>
          </MessageContent>
        );
      default:
        return null;
    }
  }
);
FinanceChatMessagePart.displayName = "FinanceChatMessagePart";
