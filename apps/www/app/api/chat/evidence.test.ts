import type { MyUIMessage } from "@repo/ai/types/message";
import type { InferUIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";
import { gateUnsourcedResearchStream } from "@/app/api/chat/evidence";

const englishNoEvidenceAnswer = "No direct source was available.";
const finishChunk = {
  type: "finish",
} satisfies InferUIMessageChunk<MyUIMessage>;
const indonesianNoEvidenceAnswer = "Tidak ada sumber langsung yang tersedia.";

/** Creates a UI chunk stream for evidence-gate tests. */
function createChunkStream(chunks: InferUIMessageChunk<MyUIMessage>[]) {
  return new ReadableStream<InferUIMessageChunk<MyUIMessage>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }

      controller.close();
    },
  });
}

/** Reads all chunks from a UI chunk stream. */
async function readChunks(
  stream: ReadableStream<InferUIMessageChunk<MyUIMessage>>
) {
  const chunks: InferUIMessageChunk<MyUIMessage>[] = [];
  const reader = stream.getReader();

  while (true) {
    const result = await reader.read();

    if (result.done) {
      reader.releaseLock();
      return chunks;
    }

    chunks.push(result.value);
  }
}

describe("research evidence gate", () => {
  it("passes text through while research has usable evidence", async () => {
    const state = { blocked: false };
    const stream = gateUnsourcedResearchStream({
      getNoEvidenceAnswer: () => indonesianNoEvidenceAnswer,
      shouldBlock: () => false,
      state,
      stream: createChunkStream([
        { id: "text", type: "text-start" },
        { delta: "Ada sumber resmi.", id: "text", type: "text-delta" },
        { id: "text", type: "text-end" },
        finishChunk,
      ]),
    });

    await expect(readChunks(stream)).resolves.toEqual([
      { id: "text", type: "text-start" },
      { delta: "Ada sumber resmi.", id: "text", type: "text-delta" },
      { id: "text", type: "text-end" },
      finishChunk,
    ]);
    expect(state.blocked).toBe(false);
  });

  it("replaces unsupported research text with one Indonesian no-evidence answer", async () => {
    const state = { blocked: false };
    const stream = gateUnsourcedResearchStream({
      getNoEvidenceAnswer: () => indonesianNoEvidenceAnswer,
      shouldBlock: () => true,
      state,
      stream: createChunkStream([
        { id: "text", type: "text-start" },
        {
          delta: "Aturan resmi sudah tersedia.",
          id: "text",
          type: "text-delta",
        },
        { id: "text", type: "text-end" },
        finishChunk,
      ]),
    });

    await expect(readChunks(stream)).resolves.toEqual([
      { id: "text", type: "text-start" },
      {
        delta: indonesianNoEvidenceAnswer,
        id: "text",
        type: "text-delta",
      },
      { id: "text", type: "text-end" },
      finishChunk,
    ]);
    expect(state.blocked).toBe(true);
  });

  it("injects an English no-evidence answer when blocked research has no text part", async () => {
    const state = { blocked: false };
    const stream = gateUnsourcedResearchStream({
      getNoEvidenceAnswer: () => englishNoEvidenceAnswer,
      shouldBlock: () => true,
      state,
      stream: createChunkStream([finishChunk]),
    });

    await expect(readChunks(stream)).resolves.toEqual([
      { id: "research-evidence-gate", type: "text-start" },
      {
        delta: englishNoEvidenceAnswer,
        id: "research-evidence-gate",
        type: "text-delta",
      },
      { id: "research-evidence-gate", type: "text-end" },
      finishChunk,
    ]);
    expect(state.blocked).toBe(true);
  });

  it("suppresses later text parts after the no-evidence answer has been written", async () => {
    const state = { blocked: false };
    const stream = gateUnsourcedResearchStream({
      getNoEvidenceAnswer: () => indonesianNoEvidenceAnswer,
      shouldBlock: () => true,
      state,
      stream: createChunkStream([
        { id: "first", type: "text-start" },
        { delta: "Klaim pertama.", id: "first", type: "text-delta" },
        { id: "first", type: "text-end" },
        { id: "second", type: "text-start" },
        { delta: "Klaim kedua.", id: "second", type: "text-delta" },
        { id: "second", type: "text-end" },
        finishChunk,
      ]),
    });

    await expect(readChunks(stream)).resolves.toEqual([
      { id: "first", type: "text-start" },
      {
        delta: indonesianNoEvidenceAnswer,
        id: "first",
        type: "text-delta",
      },
      { id: "first", type: "text-end" },
      finishChunk,
    ]);
    expect(state.blocked).toBe(true);
  });
});
