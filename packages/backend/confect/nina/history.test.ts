import { describe, expect, it } from "@effect/vitest";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import { assembleContext, boundStep } from "@repo/backend/confect/nina/history";
import type { ModelMessage } from "ai";

/** One complete turn with a verified capability result. */
function turn(
  question: string,
  evidence = "Verified evidence."
): ModelMessage[] {
  return [
    { role: "user", content: question },
    {
      role: "assistant",
      content: [
        { type: "reasoning", text: "Private chain" },
        {
          type: "tool-call",
          toolCallId: `${question}-call`,
          toolName: "nakafa",
          input: {},
        },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: `${question}-call`,
          toolName: "nakafa",
          output: {
            type: "json",
            value: { text: evidence, artifacts: [] },
          },
        },
      ],
    },
    { role: "assistant", content: `Answer to ${question}` },
  ];
}

function tokens(messages: readonly ModelMessage[]) {
  return countTextTokens(JSON.stringify(messages));
}

describe("Nina provider context", () => {
  it("projects stored evidence to text without changing the transcript or losing tool pairs", () => {
    const history = turn("Explain the page");
    const before = JSON.stringify(history);
    const result = assembleContext({
      current: [{ role: "user", content: "Next question" }],
      currentOrder: 1,
      recent: history,
      throughOrder: null,
    });
    expect(JSON.stringify(history)).toBe(before);
    expect(result).toEqual([
      history[0],
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "Explain the page-call",
            toolName: "nakafa",
            input: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "Explain the page-call",
            toolName: "nakafa",
            output: { type: "text", value: "Verified evidence." },
          },
        ],
      },
      history[3],
      { role: "user", content: "Next question" },
    ]);
  });

  it("keeps verified evidence of an unavailable capability and drops raw foreign output", () => {
    const result = boundStep([
      { role: "user", content: "Compute the determinant" },
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolName: "determinant",
            toolCallId: "old",
            input: {},
          },
          {
            type: "tool-call",
            toolName: "foreign",
            toolCallId: "raw",
            input: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "determinant",
            toolCallId: "old",
            output: {
              type: "json",
              value: { text: "Verified determinant: -2", artifacts: [] },
            },
          },
          {
            type: "tool-result",
            toolName: "foreign",
            toolCallId: "raw",
            output: { type: "json", value: { result: true } },
          },
        ],
      },
      { role: "assistant", content: "The result is -2" },
    ]);
    expect(result).toEqual([
      { role: "user", content: "Compute the determinant" },
      { role: "assistant", content: "Verified determinant: -2" },
      { role: "assistant", content: "The result is -2" },
    ]);
  });

  it("keeps malformed or non-JSON stored results as bounded text instead of failing", () => {
    const result = boundStep([
      { role: "user", content: "Check the work" },
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolName: "math", toolCallId: "a", input: {} },
          { type: "tool-call", toolName: "math", toolCallId: "b", input: {} },
          { type: "tool-call", toolName: "math", toolCallId: "c", input: {} },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolName: "math",
            toolCallId: "a",
            output: { type: "json", value: { text: 42 } },
          },
          {
            type: "tool-result",
            toolName: "math",
            toolCallId: "b",
            output: { type: "error-text", value: "CAS unavailable" },
          },
          {
            type: "tool-result",
            toolName: "math",
            toolCallId: "c",
            output: { type: "execution-denied", reason: "Not allowed" },
          },
          // The SDK prunes an approval response without its request.
          { type: "tool-approval-response", approvalId: "c", approved: false },
        ],
      },
    ]);
    expect(result.at(-1)).toEqual({
      role: "tool",
      content: [
        expect.objectContaining({
          output: {
            type: "text",
            value: '{"type":"json","value":{"text":42}}',
          },
        }),
        expect.objectContaining({
          output: { type: "text", value: "CAS unavailable" },
        }),
        expect.objectContaining({
          output: {
            type: "text",
            value: '{"type":"execution-denied","reason":"Not allowed"}',
          },
        }),
      ],
    });
  });

  it("omits turns the rolling summary already covers", () => {
    const recent = [...turn("First"), ...turn("Second"), ...turn("Third")];
    const result = assembleContext({
      current: [{ role: "user", content: "Fourth" }],
      currentOrder: 3,
      recent,
      throughOrder: 1,
    });
    expect(result[0]).toEqual({ role: "user", content: "Third" });
    expect(JSON.stringify(result)).not.toContain("First");
    expect(JSON.stringify(result)).not.toContain("Second");
  });

  it("keeps whole newest turns within the history budget and drops a cut turn", () => {
    const large = "Long evidence paragraph.\n\n".repeat(900);
    const recent: ModelMessage[] = [
      { role: "assistant", content: "Tail of an older turn" },
      ...turn("Old", large),
      ...turn("Middle", large),
      ...turn("New", large),
    ];
    const result = assembleContext({
      current: [{ role: "user", content: "Latest" }],
      currentOrder: 10,
      recent,
      throughOrder: null,
    });
    const history = result.slice(0, -1);
    expect(tokens(history)).toBeLessThanOrEqual(NINA_BUDGET.history + 200);
    expect(history[0]).toMatchObject({ role: "user" });
    expect(JSON.stringify(result)).not.toContain("Tail of an older turn");
    expect(JSON.stringify(result)).not.toContain("Answer to Old");
    expect(JSON.stringify(result)).toContain("Answer to New");
  });

  it("shortens the evidence of one oversized newest turn instead of dropping it", () => {
    const huge = "Evidence paragraph.\n\n".repeat(20_000);
    // Three results each fill the evidence budget, so the turn outgrows history.
    const oversized = [
      ...turn("Huge", huge),
      ...turn("Huge", huge).slice(1, 3),
      ...turn("Huge", huge).slice(1, 3),
    ];
    const result = assembleContext({
      current: [{ role: "user", content: "Follow up" }],
      currentOrder: 1,
      recent: oversized,
      throughOrder: null,
    });
    expect(result[0]).toEqual({ role: "user", content: "Huge" });
    expect(JSON.stringify(result)).toContain(
      "Earlier evidence in this conversation, shortened."
    );
    expect(tokens(result)).toBeLessThanOrEqual(NINA_BUDGET.history);
  });

  it("counts attachments as flat file tokens, not their bytes", () => {
    const recent: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "Read this photo" },
          {
            type: "file",
            mediaType: "image/png",
            data: "A".repeat(2_000_000),
          },
        ],
      },
      { role: "assistant", content: "It shows a parabola." },
    ];
    const result = assembleContext({
      current: [{ role: "user", content: "Explain more" }],
      currentOrder: 1,
      recent,
      throughOrder: null,
    });
    expect(result).toHaveLength(3);
  });

  it("keeps earlier images but leaves earlier documents as a note", () => {
    const current: ModelMessage = {
      role: "user",
      content: [
        { type: "text", text: "And this one?" },
        { type: "file", mediaType: "text/plain", data: "New notes" },
      ],
    };
    const result = assembleContext({
      current: [current],
      currentOrder: 1,
      recent: [
        {
          role: "user",
          content: [
            { type: "text", text: "Read these" },
            { type: "file", mediaType: "image/png", data: "photo" },
            {
              type: "file",
              mediaType: "application/pdf",
              filename: "worksheet.pdf",
              data: "A".repeat(2_000_000),
            },
            { type: "file", mediaType: "text/plain", data: "notes" },
          ],
        },
        { role: "assistant", content: "Both cover limits." },
      ],
      throughOrder: null,
    });
    expect(result[0]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "Read these" },
        { type: "file", mediaType: "image/png", data: "photo" },
        {
          type: "text",
          text: "[Attached earlier: worksheet.pdf (application/pdf). Ask the learner to attach it again when its full content matters.]",
        },
        {
          type: "text",
          text: "[Attached earlier: a document (text/plain). Ask the learner to attach it again when its full content matters.]",
        },
      ],
    });
    expect(result.at(-1)).toEqual(current);
  });

  it("keeps approval parts while shortening the evidence around them", () => {
    const evidence = "Approved evidence paragraph.\n\n".repeat(900);
    const result = boundStep([
      { role: "user", content: "Use the approved tool" },
      ...[1, 2, 3, 4].flatMap((round): ModelMessage[] => [
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: `call-${round}`,
              toolName: "nakafa",
              input: {},
            },
            {
              type: "tool-approval-request",
              approvalId: `approval-${round}`,
              toolCallId: `call-${round}`,
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-approval-response",
              approvalId: `approval-${round}`,
              approved: true,
            },
            {
              type: "tool-result",
              toolCallId: `call-${round}`,
              toolName: "nakafa",
              output: {
                type: "json",
                value: { text: evidence, artifacts: [] },
              },
            },
          ],
        },
      ]),
    ]);
    expect(result[2]).toMatchObject({
      role: "tool",
      content: [
        { type: "tool-approval-response", approvalId: "approval-1" },
        expect.objectContaining({
          output: {
            type: "text",
            value: expect.stringContaining("shortened"),
          },
        }),
      ],
    });
  });

  it("shortens older evidence within the current turn and keeps the newest result", () => {
    const evidence = "Current evidence paragraph.\n\n".repeat(900);
    const toolRound = (id: string): ModelMessage[] => [
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolCallId: id, toolName: "nakafa", input: {} },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: id,
            toolName: "nakafa",
            output: { type: "json", value: { text: evidence, artifacts: [] } },
          },
        ],
      },
    ];
    const history = turn("Earlier", evidence);
    const result = boundStep([
      ...history,
      { role: "user", content: "Gather everything" },
      ...toolRound("one"),
      ...toolRound("two"),
      ...toolRound("three"),
      ...toolRound("four"),
    ]);
    const current = result.slice(
      result.findIndex(
        (message) =>
          message.role === "user" && message.content === "Gather everything"
      )
    );
    expect(tokens(current)).toBeLessThanOrEqual(NINA_BUDGET.turnEvidence + 400);
    expect(JSON.stringify(current.at(-1))).not.toContain("shortened");
    expect(JSON.stringify(current[2])).toContain("shortened");
    expect(result[2]).toMatchObject({
      role: "tool",
      content: [
        expect.objectContaining({ output: { type: "text", value: evidence } }),
      ],
    });
  });
});
