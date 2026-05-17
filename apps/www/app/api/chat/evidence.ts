import type { InferUIMessageChunk, UIMessage } from "ai";

interface ResearchEvidenceGateState {
  blocked: boolean;
}

interface GateUnsourcedResearchStreamOptions<UI_MESSAGE extends UIMessage> {
  getNoEvidenceAnswer: () => string;
  shouldBlock: () => boolean;
  state: ResearchEvidenceGateState;
  stream: ReadableStream<InferUIMessageChunk<UI_MESSAGE>>;
}

/** Replaces unsupported research final text with the research agent's generated no-evidence answer. */
export function gateUnsourcedResearchStream<UI_MESSAGE extends UIMessage>({
  getNoEvidenceAnswer,
  shouldBlock,
  state,
  stream,
}: GateUnsourcedResearchStreamOptions<UI_MESSAGE>) {
  let suppressedTextId: string | undefined;
  let wroteNoEvidenceAnswer = false;

  return stream.pipeThrough(
    new TransformStream<InferUIMessageChunk<UI_MESSAGE>>({
      transform(chunk, controller) {
        if (!shouldBlock()) {
          controller.enqueue(chunk);
          return;
        }

        if (chunk.type === "text-start" && "id" in chunk) {
          suppressedTextId = chunk.id;
          state.blocked = true;

          if (!wroteNoEvidenceAnswer) {
            wroteNoEvidenceAnswer = true;
            const noEvidenceAnswer = getNoEvidenceAnswer();
            controller.enqueue(chunk);
            controller.enqueue({
              delta: noEvidenceAnswer,
              id: chunk.id,
              type: "text-delta",
            });
            controller.enqueue({
              id: chunk.id,
              type: "text-end",
            });
          }

          return;
        }

        if (
          suppressedTextId &&
          chunk.type === "text-delta" &&
          "id" in chunk &&
          chunk.id === suppressedTextId
        ) {
          return;
        }

        if (
          suppressedTextId &&
          chunk.type === "text-end" &&
          "id" in chunk &&
          chunk.id === suppressedTextId
        ) {
          suppressedTextId = undefined;
          return;
        }

        if (chunk.type === "finish" && !wroteNoEvidenceAnswer) {
          state.blocked = true;
          wroteNoEvidenceAnswer = true;
          const noEvidenceAnswer = getNoEvidenceAnswer();
          controller.enqueue({
            id: "research-evidence-gate",
            type: "text-start",
          });
          controller.enqueue({
            delta: noEvidenceAnswer,
            id: "research-evidence-gate",
            type: "text-delta",
          });
          controller.enqueue({
            id: "research-evidence-gate",
            type: "text-end",
          });
        }

        controller.enqueue(chunk);
      },
    })
  );
}
