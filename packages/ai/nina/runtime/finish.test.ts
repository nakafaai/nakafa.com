// @vitest-environment node

import {
  getNinaResponseFailure,
  IncompleteNinaResponseError,
} from "@repo/ai/nina/runtime/finish";
import type { DataPart } from "@repo/ai/schema/data";
import type { MyUIMessage } from "@repo/ai/types/message";
import { describe, expect, it } from "vitest";

const completeAssistantMessage = {
  id: "assistant-complete",
  role: "assistant",
  parts: [{ type: "text", text: "Jawaban final.", state: "done" }],
} satisfies MyUIMessage;

describe("nina/runtime/finish", () => {
  it("accepts an assistant response with final text", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: completeAssistantMessage,
    });

    expect(failure).toBeUndefined();
  });

  it("accepts a completed MathReasoning card without duplicate final text", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-math-card",
        role: "assistant",
        parts: [
          {
            data: mathReasoningDataPart(),
            id: "math-call",
            type: "data-math-reasoning",
          },
        ],
      },
    });

    expect(failure).toBeUndefined();
  });

  it("rejects a MathReasoning error row without final prose", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-math-error",
        role: "assistant",
        parts: [
          {
            data: {
              errorKey: "math-error",
              input: {
                givens: ["x +"],
                objective: "Factor the expression.",
                request: "factor x +",
                requirements: [],
              },
              status: "error",
            },
            id: "math-call",
            type: "data-math-reasoning",
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "missing-final-text",
      responseMessageId: "assistant-math-error",
    });
  });

  it("accepts a MathReasoning error row with final prose", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-math-error-with-text",
        role: "assistant",
        parts: [
          {
            data: {
              errorKey: "math-error",
              input: {
                givens: ["x +"],
                objective: "Factor the expression.",
                request: "factor x +",
                requirements: [],
              },
              status: "error",
            },
            id: "math-call",
            type: "data-math-reasoning",
          },
          {
            state: "done",
            text: "Aku perlu bentuk lengkapnya sebelum menghitung.",
            type: "text",
          },
        ],
      },
    });

    expect(failure).toBeUndefined();
  });

  it("rejects a loading MathReasoning card without final text", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-loading-math-card",
        role: "assistant",
        parts: [
          {
            data: {
              input: {
                givens: ["x^2 = 4"],
                objective: "Solve with the positive domain.",
                request: "solve x^2 = 4",
                requirements: ["x > 0"],
              },
              status: "loading",
            },
            id: "math-call",
            type: "data-math-reasoning",
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "missing-final-text",
      responseMessageId: "assistant-loading-math-card",
    });
  });

  it("rejects a corrupt MathReasoning card without final text", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: corruptMathReasoningMessage(),
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "missing-final-text",
      responseMessageId: "assistant-corrupt-math-card",
    });
  });

  it("rejects an aborted assistant response", () => {
    const failure = getNinaResponseFailure({
      isAborted: true,
      responseMessage: completeAssistantMessage,
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "aborted",
      responseMessageId: "assistant-complete",
    });
  });

  it("rejects a response with an open reasoning part", () => {
    const failure = getNinaResponseFailure({
      finishReason: "stop",
      isAborted: false,
      responseMessage: {
        id: "assistant-reasoning",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "Masih berpikir.", state: "streaming" },
          { type: "text", text: "Jawaban final.", state: "done" },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      finishReason: "stop",
      reason: "open-stream-part",
      responseMessageId: "assistant-reasoning",
    });
  });

  it("rejects a response with suggestions but no final text", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-suggestions",
        role: "assistant",
        parts: [
          {
            id: "suggestions",
            type: "data-suggestions",
            data: { data: ["Apa contoh lainnya?"] },
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "missing-final-text",
      responseMessageId: "assistant-suggestions",
    });
  });

  it("rejects a response with an open tool part", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-open-tool",
        role: "assistant",
        parts: [
          { type: "text", text: "Jawaban final.", state: "done" },
          {
            type: "tool-nakafa",
            state: "input-available",
            toolCallId: "nakafa-call",
            input: {
              deliverables: ["answer"],
              objective: "Retrieve Nakafa context.",
              request: "hi",
            },
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "open-stream-part",
      responseMessageId: "assistant-open-tool",
    });
  });

  it("rejects a response with a streaming tool input", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-streaming-tool",
        role: "assistant",
        parts: [
          { type: "text", text: "Jawaban final.", state: "done" },
          {
            type: "tool-math",
            state: "input-streaming",
            toolCallId: "math-call",
            input: {
              given: ["x = 1"],
              math: {
                expression: "x = 1",
                kind: "math",
                operation: "solve",
                variables: ["x"],
              },
              objective: "Verify math.",
              request: "x = 1",
            },
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "open-stream-part",
      responseMessageId: "assistant-streaming-tool",
    });
  });

  it("rejects a response with an open dynamic tool part", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-dynamic-tool",
        role: "assistant",
        parts: [
          { type: "text", text: "Jawaban final.", state: "done" },
          {
            type: "dynamic-tool",
            state: "input-available",
            toolCallId: "dynamic-call",
            toolName: "dynamicTool",
            input: { request: "hi" },
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteNinaResponseError);
    expect(failure).toMatchObject({
      reason: "open-stream-part",
      responseMessageId: "assistant-dynamic-tool",
    });
  });

  it("accepts a response with terminal tool output and final text", () => {
    const failure = getNinaResponseFailure({
      isAborted: false,
      responseMessage: {
        id: "assistant-terminal-tool",
        role: "assistant",
        parts: [
          {
            type: "tool-nakafa",
            state: "output-available",
            toolCallId: "nakafa-call",
            input: {
              deliverables: ["answer"],
              objective: "Retrieve Nakafa context.",
              request: "hi",
            },
            output: "Evidence.",
          },
          { type: "text", text: "Jawaban final.", state: "done" },
        ],
      },
    });

    expect(failure).toBeUndefined();
  });
});

/** Builds the compact MathReasoning answer shape accepted by finish validation. */
function mathReasoningDataPart(): DataPart["math-reasoning"] {
  return {
    result: {
      artifacts: [],
      steps: [],
      work: {
        assumptions: [],
        computations: [
          {
            conditions: [],
            input: {
              expression: "x^2 - 4 = 0",
              kind: "math",
              operation: "solve",
            },
            items: [],
            kind: "solve",
            operation: "solve",
            primary: {
              expression: "x^2 - 4 = 0",
              latex: "x^2 - 4 = 0",
            },
            secondary: {
              expression: "x = 2",
              latex: "x = 2",
            },
            stepStatus: "complete",
            steps: [],
            status: "verified",
          },
        ],
        input: {
          givens: ["x^2 = 4"],
          kind: "prompt",
          locale: "id",
          objective: "Solve with the positive domain.",
          text: "solve x^2 = 4",
        },
        limitations: [],
        plannedRequest: {
          expression: "x^2 = 4",
          kind: "math",
          lower: "0",
          operation: "solve",
          variable: "x",
        },
        primaryResult: {
          expression: "x = 2",
          latex: "x = 2",
        },
        status: "ready",
        verification: {
          engine: "sympy",
          lane: "verified",
          reasonKey: "math-verification-verified",
          source: "cas.solve",
          values: [],
        },
        workId: "math:solve:finish",
      },
    },
    status: "done",
  };
}

/** Builds an externally corrupted UI message that should fail schema decoding. */
function corruptMathReasoningMessage(): MyUIMessage {
  return JSON.parse(`{
    "id": "assistant-corrupt-math-card",
    "role": "assistant",
    "parts": [
      {
        "data": { "status": "done" },
        "id": "math-call",
        "type": "data-math-reasoning"
      }
    ]
  }`);
}
