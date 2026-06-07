// @vitest-environment node
import type { MyUIMessage } from "@repo/ai/types/message";
import { describe, expect, it } from "vitest";
import {
  getAssistantResponseFailure,
  IncompleteChatResponseError,
} from "@/app/api/chat/response";

const completeAssistantMessage = {
  id: "assistant-complete",
  role: "assistant",
  parts: [{ type: "text", text: "Jawaban final.", state: "done" }],
} satisfies MyUIMessage;

describe("app/api/chat/response", () => {
  it("accepts an assistant response with final text", () => {
    const failure = getAssistantResponseFailure({
      isAborted: false,
      responseMessage: completeAssistantMessage,
    });

    expect(failure).toBeUndefined();
  });

  it("rejects an aborted assistant response", () => {
    const failure = getAssistantResponseFailure({
      isAborted: true,
      responseMessage: completeAssistantMessage,
    });

    expect(failure).toBeInstanceOf(IncompleteChatResponseError);
    expect(failure).toMatchObject({
      reason: "aborted",
      responseMessageId: "assistant-complete",
    });
  });

  it("rejects a response with an open reasoning part", () => {
    const failure = getAssistantResponseFailure({
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

    expect(failure).toBeInstanceOf(IncompleteChatResponseError);
    expect(failure).toMatchObject({
      finishReason: "stop",
      reason: "open-stream-part",
      responseMessageId: "assistant-reasoning",
    });
  });

  it("rejects a response with suggestions but no final text", () => {
    const failure = getAssistantResponseFailure({
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

    expect(failure).toBeInstanceOf(IncompleteChatResponseError);
    expect(failure).toMatchObject({
      reason: "missing-final-text",
      responseMessageId: "assistant-suggestions",
    });
  });

  it("rejects a response with an open tool part", () => {
    const failure = getAssistantResponseFailure({
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

    expect(failure).toBeInstanceOf(IncompleteChatResponseError);
    expect(failure).toMatchObject({
      reason: "open-stream-part",
      responseMessageId: "assistant-open-tool",
    });
  });

  it("rejects a response with a streaming tool input", () => {
    const failure = getAssistantResponseFailure({
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
              objective: "Verify math.",
              request: "x = 1",
            },
          },
        ],
      },
    });

    expect(failure).toBeInstanceOf(IncompleteChatResponseError);
    expect(failure).toMatchObject({
      reason: "open-stream-part",
      responseMessageId: "assistant-streaming-tool",
    });
  });

  it("rejects a response with an open dynamic tool part", () => {
    const failure = getAssistantResponseFailure({
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

    expect(failure).toBeInstanceOf(IncompleteChatResponseError);
    expect(failure).toMatchObject({
      reason: "open-stream-part",
      responseMessageId: "assistant-dynamic-tool",
    });
  });

  it("accepts a response with terminal tool output and final text", () => {
    const failure = getAssistantResponseFailure({
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
