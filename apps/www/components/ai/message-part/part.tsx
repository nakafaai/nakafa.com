"use client";

import {
  type CapabilityArtifact,
  CapabilityOutputSchema,
} from "@repo/backend/confect/nina/capability/progress";
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
import { type DynamicToolUIPart, isToolUIPart, type ToolUIPart } from "ai";
import { Match, Result, Schema } from "effect";
import { NinaAttachment } from "@/components/ai/attachment";
import { AiChatPersistedError } from "@/components/ai/chat-error";
import { useMessage } from "@/components/ai/context/use-message";
import { MathPart } from "@/components/ai/message-part/math";
import { NakafaPart } from "@/components/ai/message-part/nakafa";
import { ScrapeUrlPart } from "@/components/ai/message-part/scrape-url";
import { WebSearchPart } from "@/components/ai/message-part/web-search";

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
    return <ToolOutput part={part} />;
  }
  return null;
}

/** Decode the capability result only after the Agent has completed its tool. */
function ToolOutput({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  if (part.state === "output-error") {
    return <AiChatPersistedError />;
  }
  if (part.state !== "output-available") {
    return null;
  }
  const output = Schema.decodeUnknownResult(CapabilityOutputSchema)(
    part.output
  );
  if (Result.isFailure(output)) {
    return <AiChatPersistedError />;
  }
  return output.success.artifacts.map((artifact) => (
    <Evidence artifact={artifact} key={`${artifact.type}:${artifact.id}`} />
  ));
}

function Evidence({ artifact }: { artifact: CapabilityArtifact }) {
  return Match.value(artifact).pipe(
    Match.discriminatorsExhaustive("type")({
      "data-math": ({ data }) => <MathPart message={data} />,
      "data-nakafa": ({ data }) => <NakafaPart message={data} />,
      "data-scrape-url": ({ data }) => <ScrapeUrlPart message={data} />,
      "data-web-search": ({ data }) => <WebSearchPart message={data} />,
    })
  );
}
