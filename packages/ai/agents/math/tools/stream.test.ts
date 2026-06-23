import { writeMathEvidencePart } from "@repo/ai/agents/math/tools/stream";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { MathData } from "@repo/math/schema/data";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("writeMathEvidencePart", () => {
  it("keeps ordinary math evidence visible in the chat stream", async () => {
    const parts: unknown[] = [];
    const data = {
      input: {
        expression: "6 * 7",
        kind: "math",
        operation: "evaluate",
      },
      kind: "evaluate",
      status: "loading",
    } satisfies MathData;

    await Effect.runPromise(
      writeMathEvidencePart({
        data,
        toolCallId: "math-visible",
        writer: writerFor(parts),
      })
    );

    expect(parts).toEqual([
      expect.objectContaining({
        data,
        id: "math-visible",
        type: "data-math",
      }),
    ]);
  });

  it("suppresses coordinate artifact loading placeholders", async () => {
    const parts: unknown[] = [];
    const lineData = coordinateLoadingData("line");
    const circleData = coordinateLoadingData("circle");

    await Effect.runPromise(
      writeMathEvidencePart({
        data: lineData,
        toolCallId: "math-line",
        writer: writerFor(parts),
      })
    );
    await Effect.runPromise(
      writeMathEvidencePart({
        data: circleData,
        toolCallId: "math-circle",
        writer: writerFor(parts),
      })
    );

    expect(parts).toEqual([]);
  });

  it("keeps coordinate artifact failures out of the legacy chart path", async () => {
    const parts: unknown[] = [];
    const data = {
      error: "math_check_unavailable",
      input: {
        kind: "math",
        operation: "line",
        points: [
          { x: "0", y: "0" },
          { x: "3", y: "2" },
        ],
      },
      kind: "line",
      status: "error",
    } satisfies MathData;

    await Effect.runPromise(
      writeMathEvidencePart({
        data,
        toolCallId: "math-line-error",
        writer: writerFor(parts),
      })
    );

    expect(parts).toEqual([]);
  });
});

/** Creates the minimal AI SDK writer needed to observe streamed data parts. */
function writerFor(parts: unknown[]) {
  return {
    merge: () => undefined,
    onError: undefined,
    write: (
      part: Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0]
    ) => {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;
}

/** Builds coordinate evidence that should be owned by the 3D artifact stream. */
function coordinateLoadingData(operation: "circle" | "line") {
  return {
    input: {
      kind: "math",
      operation,
      points: [
        { x: "0", y: "0" },
        { x: "3", y: "2" },
      ],
    },
    kind: operation,
    status: "loading",
  } satisfies MathData;
}
