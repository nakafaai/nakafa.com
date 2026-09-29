"use client";

import { useSmoothText } from "@convex-dev/agent/react";
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
import {
  type DynamicToolUIPart,
  isToolUIPart,
  type TextUIPart,
  type ToolUIPart,
} from "ai";
import { NinaAttachment } from "@/components/ai/attachment";
import { Activity } from "@/components/ai/message/activity";
import { useMessage } from "@/components/ai/message/context";
import { EvidenceList } from "@/components/ai/message/evidence/list";
import { readInvocation } from "@/components/ai/message/invocation";

/** Agent owns SDK parts; evidence card payloads obey Nina's runtime contract. */
export function AiMessagePart({
  part,
  partKey,
}: {
  part: NinaMessage["parts"][number];
  partKey: string;
}) {
  // The message key, unlike its id, survives the handoff from stream to saved.
  const messageKey = useMessage((state) => state.message.key);
  const id = `${messageKey}-${partKey}`;
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
    return <NinaText id={id} part={part} />;
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
          <ReasoningContent>
            <Response id={id} isStreaming={part.state === "streaming"}>
              {part.text}
            </Response>
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

/**
 * Paces streamed text at the rate it arrives, so throttled Agent deltas read as
 * steady writing instead of bursts. Finished parts render at once, and a
 * formula appears once its source is complete.
 */
function NinaText({ id, part }: { id: string; part: TextUIPart }) {
  const streaming = part.state === "streaming";
  const [text, { isStreaming }] = useSmoothText(part.text, {
    startStreaming: streaming,
  });
  return (
    <Response id={id} isStreaming={streaming || isStreaming}>
      {text}
    </Response>
  );
}

/** One native Agent invocation owns its live progress and persisted evidence. */
function NinaActivity({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const status = useMessage((state) => state.turn?.state.status);
  const settled =
    status === "cancelled" || status === "failed" || status === "complete";
  return (
    <Activity invocation={readInvocation(part, settled)}>
      <EvidenceList />
    </Activity>
  );
}
