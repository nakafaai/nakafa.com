"use client";

import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/design-system/components/ai/reasoning";
import { Response } from "@repo/design-system/components/ai/response";
import {
  Source,
  SourceTrigger,
} from "@repo/design-system/components/ai/source";
import { isToolUIPart } from "ai";
import { NinaAttachment } from "@/components/ai/attachment";
import { useMessage } from "@/components/ai/context/use-message";
import { NinaActivity } from "@/components/ai/message-part/activity";

/** Agent owns SDK parts; evidence card payloads obey Nina's runtime contract. */
export function AiMessagePart({
  part,
  partIndex,
}: {
  part: NinaMessage["parts"][number];
  partIndex: number;
}) {
  const messageId = useMessage((state) => state.message.id);
  if (part.type === "file") {
    return <NinaAttachment file={part} />;
  }
  if (part.type === "source-url") {
    if (
      !(
        URL.canParse(part.url) &&
        ["https:", "http:"].includes(new URL(part.url).protocol)
      )
    ) {
      return null;
    }
    return (
      <Source href={part.url}>
        <SourceTrigger label={part.title} />
      </Source>
    );
  }
  if (part.type === "text") {
    return (
      <Response id={`${messageId}-part-${partIndex}`}>{part.text}</Response>
    );
  }
  if (part.type === "reasoning") {
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
  if (isToolUIPart(part)) {
    return <NinaActivity part={part} />;
  }
  return null;
}
