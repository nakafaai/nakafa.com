import { useReducedMotion } from "@mantine/hooks";
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
import { Array as Arr } from "effect";
import { animate } from "motion";
import { useMotionValue, useMotionValueEvent } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { NinaAttachment } from "@/components/ai/attachment";
import { Activity } from "@/components/ai/message/activity";
import { useMessage } from "@/components/ai/message/context";
import { EvidenceList } from "@/components/ai/message/evidence/list";
import type { AnswerPart, OtherPart } from "@/components/ai/message/group";
import { readInvocation } from "@/components/ai/message/invocation";

/** Agent owns SDK parts; evidence card payloads obey Nina's runtime contract. */
export function AiMessagePart({
  part,
  partKey,
}: {
  part: OtherPart;
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
        Arr.contains(["https:", "http:"], new URL(part.url).protocol)
      )
    ) {
      return null;
    }
    return (
      <Source href={part.url}>
        <SourceTrigger title={part.title} />
      </Source>
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
          <ReasoningContent>
            <Response
              id={id}
              isStreaming={part.state === "streaming"}
              variant="note"
            >
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
 * The longest a piece of streamed text takes to write out once it arrives, in
 * seconds. A fast model sends a whole paragraph in one delta of a quarter
 * second; written over this time instead, it reads as writing, and a steady
 * stream never runs further than this behind the model.
 */
const WRITE_SECONDS = 1.5;
/** The slowest writing pace, in letters a second, so a few last words never crawl. */
const SLOWEST_PACE = 80;

/**
 * Writes streamed text letter by letter through Motion. Agent's `useSmoothText`
 * keeps pace with the stream, so a paragraph that arrives in one delta lands
 * within a frame or two, and a short answer appears at once. This writes every
 * arrival over at most `WRITE_SECONDS` instead. Text that was complete when the
 * part mounted shows at once, and so does all text with reduced motion.
 */
function useWrittenText(text: string, streaming: boolean) {
  const shouldReduceMotion = useReducedMotion();
  const letters = useMotionValue(streaming ? 0 : text.length);
  const [written, setWritten] = useState(() => letters.get());

  useMotionValueEvent(letters, "change", (latest) => {
    setWritten(Math.round(latest));
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }
    const remaining = text.length - letters.get();
    if (remaining <= 0) {
      return;
    }
    const controls = animate(letters, text.length, {
      duration: Math.min(remaining / SLOWEST_PACE, WRITE_SECONDS),
      ease: "linear",
    });
    return () => controls.stop();
  }, [letters, shouldReduceMotion, text.length]);

  const shown = shouldReduceMotion
    ? text.length
    : Math.min(written, text.length);
  return { text: text.slice(0, shown), writing: shown < text.length };
}

/**
 * Writes streamed answer text as it arrives (`useWrittenText`), so neither a
 * burst of deltas nor a short answer appears at once. Finished parts render at
 * once, and a formula appears once its source is complete. The parts after the
 * answer, such as its sources, appear once the text is written, so its last
 * lines never push them down.
 */
export function AiMessageAnswer({
  children,
  part,
  partKey,
}: {
  children: ReactNode;
  part: AnswerPart;
  partKey: string;
}) {
  // The message key, unlike its id, survives the handoff from stream to saved.
  const messageKey = useMessage((state) => state.message.key);
  const streaming = part.state === "streaming";
  const { text, writing } = useWrittenText(part.text, streaming);
  const pacing = streaming || writing;
  return (
    <>
      <Response id={`${messageKey}-${partKey}`} isStreaming={pacing}>
        {text}
      </Response>
      {pacing ? null : children}
    </>
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
