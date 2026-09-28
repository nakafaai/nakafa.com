"use client";

import { Sad02Icon } from "@hugeicons/core-free-icons";
import {
  type CapabilityArtifact,
  CapabilityOutputSchema,
} from "@repo/backend/confect/nina/capability/progress";
import { LearningCapabilityNameSchema } from "@repo/backend/confect/nina/capability/spec";
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  type DynamicToolUIPart,
  getToolName,
  isToolUIPart,
  type ToolUIPart,
} from "ai";
import { Match, Result, Schema } from "effect";
import { useTranslations } from "next-intl";
import { NinaAttachment } from "@/components/ai/attachment";
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
    return <ToolFailure part={part} />;
  }
  if (part.state !== "output-available") {
    return null;
  }
  const output = Schema.decodeUnknownResult(CapabilityOutputSchema)(
    part.output
  );
  if (Result.isFailure(output)) {
    return <ToolFailure part={part} />;
  }
  return output.success.artifacts.map((artifact) => (
    <Evidence artifact={artifact} key={`${artifact.type}:${artifact.id}`} />
  ));
}

/** A failed capability stays in its own evidence row, separate from the answer. */
function ToolFailure({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const t = useTranslations("Ai");
  const name = getToolName(part);
  const capability = Schema.is(LearningCapabilityNameSchema)(name)
    ? name
    : "unknown";
  return (
    <div className="flex items-start gap-2 text-destructive text-sm">
      <HugeIcons className="mt-0.5 size-4 shrink-0" icon={Sad02Icon} />
      <span>{t(`tool-failures.${capability}`)}</span>
    </div>
  );
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
