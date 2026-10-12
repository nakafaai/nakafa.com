import { describe, expect, it } from "@effect/vitest";
import {
  countTextTokens,
  NINA_BUDGET,
} from "@repo/backend/confect/nina/budget";
import {
  assembleContext,
  boundStep,
  newestAskings,
  sentTurn,
  splitTurns,
} from "@repo/backend/confect/nina/history";
import { encodeJsonText } from "@repo/utilities/json";
import type { ModelMessage } from "ai";
import { Array as Arr, Option } from "effect";

/** One tool call and its verified result; a turn's first call follows private reasoning. */
function toolRound(
  id: string,
  evidence: string,
  reasoning = false
): ModelMessage[] {
  return [
    {
      role: "assistant",
      content: [
        ...(reasoning
          ? [{ type: "reasoning" as const, text: "Private chain" }]
          : []),
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
}

/** One complete turn with `rounds` verified capability results. */
function turn(
  question: string,
  evidence = "Verified evidence.",
  rounds = 1
): ModelMessage[] {
  return [
    { role: "user", content: question },
    ...Arr.flatMap(Arr.range(1, rounds), (round) =>
      toolRound(
        `${question}-call${round === 1 ? "" : `-${round}`}`,
        evidence,
        round === 1
      )
    ),
    { role: "assistant", content: `Answer to ${question}` },
  ];
}

/** A tool result long enough to fill the evidence budget on its own. */
const HUGE = "Evidence paragraph.\n\n".repeat(20_000);

function tokens(messages: readonly ModelMessage[]) {
  return countTextTokens(encodeJsonText(messages));
}

describe("Nina provider context", () => {
  it("projects stored evidence to text without changing the transcript or losing tool pairs", () => {
    const history = turn("Explain the page");
    const before = encodeJsonText(history);
    const result = assembleContext({
      current: [{ role: "user", content: "Next question" }],
      history: [history],
    });
    expect(encodeJsonText(history)).toBe(before);
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

  it("keeps a step without a user prompt whole, in its own order", () => {
    const messages: ModelMessage[] = [
      { role: "assistant", content: "Earlier answer." },
      { role: "assistant", content: "Continued answer." },
    ];
    expect(boundStep(messages)).toEqual(messages);
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
    expect(Arr.last(result)).toEqual(
      Option.some({
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
      })
    );
  });

  it("keeps whole newest turns within the history budget and drops a turn that does not fit", () => {
    // Each turn holds one result at the evidence cap, so a few turns fit.
    const large = "Long evidence paragraph.\n\n".repeat(1600);
    // The turns differ in one digit of their name, so they all cost the same.
    const cost = sentTurn(turn("Turn 0", large)).tokens;
    const fits = Math.floor(NINA_BUDGET.history / cost);
    expect(fits).toBeGreaterThan(1);
    expect((fits + 1) * cost).toBeGreaterThan(NINA_BUDGET.history);
    const result = assembleContext({
      current: [{ role: "user", content: "Latest" }],
      history: Arr.makeBy(fits + 1, (index) => turn(`Turn ${index}`, large)),
    });
    const history = Arr.dropRight(result, 1);
    expect(Arr.filter(history, ({ role }) => role === "user")).toHaveLength(
      fits
    );
    expect(history[0]).toMatchObject({ role: "user" });
    // The oldest turn is dropped whole, and the newer ones stay.
    expect(encodeJsonText(result)).not.toContain('"Answer to Turn 0"');
    expect(encodeJsonText(result)).toContain('"Answer to Turn 1"');
    expect(encodeJsonText(result)).toContain(`"Answer to Turn ${fits}"`);
  });

  it("shortens the evidence of one oversized newest turn instead of dropping it", () => {
    // Six results that each fill the evidence budget outgrow the history budget.
    const result = assembleContext({
      current: [{ role: "user", content: "Follow up" }],
      history: [turn("Huge", HUGE, 6)],
    });
    expect(result[0]).toEqual({ role: "user", content: "Huge" });
    expect(encodeJsonText(result)).toContain(
      "Earlier evidence in this conversation, shortened."
    );
    expect(tokens(result)).toBeLessThanOrEqual(NINA_BUDGET.history);
  });

  it("counts an oversized turn at its shortened cost, so an older one that fits shortened stays", () => {
    // It costs more than the whole budget, but about a fifth of it once shortened.
    expect(sentTurn(turn("Huge", HUGE, 6)).tokens).toBeLessThan(
      NINA_BUDGET.history / 5
    );
    const result = assembleContext({
      current: [{ role: "user", content: "Follow up" }],
      history: [turn("Huge", HUGE, 6), turn("Next")],
    });
    expect(encodeJsonText(result)).toContain("Answer to Huge");
    expect(encodeJsonText(result)).toContain("Answer to Next");
  });

  it("counts an earlier image at what the model bills, so a few images fill the history budget", () => {
    // Odd turns name the media type and even turns do not: both count the same.
    const imageTurn = (number: number): ModelMessage[] => [
      {
        role: "user",
        content: [
          { type: "text", text: `Photo ${number}` },
          number % 2 === 0
            ? { type: "image", image: "photo" }
            : { type: "image", image: "photo", mediaType: "image/png" },
        ],
      },
      { role: "assistant", content: `Answer ${number}` },
    ];
    const result = assembleContext({
      current: [{ role: "user", content: "Latest" }],
      history: Arr.map(Arr.range(1, 30), imageTurn),
    });
    // An image costs 1,120 tokens, so 28 turns fit in 32,000 and the two oldest of 30 do not.
    expect(encodeJsonText(result)).not.toContain('"Photo 2"');
    expect(encodeJsonText(result)).toContain('"Photo 3"');
    expect(encodeJsonText(result)).toContain('"Photo 30"');
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
      history: [
        [
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
      ],
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
    expect(Arr.last(result)).toEqual(Option.some(current));
  });

  it("keeps approval parts while shortening the evidence around them", () => {
    const evidence = "Approved evidence paragraph.\n\n".repeat(900);
    const result = boundStep([
      { role: "user", content: "Use the approved tool" },
      ...Arr.flatMap([1, 2, 3, 4], (round): ModelMessage[] => [
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
    const history = turn("Earlier", evidence);
    const result = boundStep([
      ...history,
      { role: "user", content: "Gather everything" },
      ...toolRound("one", evidence),
      ...toolRound("two", evidence),
      ...toolRound("three", evidence),
      ...toolRound("four", evidence),
    ]);
    const current = Arr.drop(
      result,
      Option.getOrThrow(
        Arr.findFirstIndex(
          result,
          (message) =>
            message.role === "user" && message.content === "Gather everything"
        )
      )
    );
    expect(tokens(current)).toBeLessThanOrEqual(NINA_BUDGET.turnEvidence + 400);
    expect(encodeJsonText(Option.getOrThrow(Arr.last(current)))).not.toContain(
      "shortened"
    );
    expect(encodeJsonText(current[2])).toContain("shortened");
    expect(result[2]).toMatchObject({
      role: "tool",
      content: [
        expect.objectContaining({ output: { type: "text", value: evidence } }),
      ],
    });
  });

  it("does not count the learner's message or its attachments against the evidence budget", () => {
    const evidence = "Small evidence paragraph.\n\n".repeat(400);
    // Fifteen images alone cost 16,800 tokens, more than the whole evidence budget.
    const prompt: ModelMessage = {
      role: "user",
      content: [
        { type: "text", text: "A long question. ".repeat(3000) },
        ...Arr.makeBy(15, () => ({ type: "image" as const, image: "photo" })),
      ],
    };
    const messages = [
      prompt,
      ...toolRound("one", evidence),
      ...toolRound("two", evidence),
    ];
    expect(boundStep(messages)).toEqual(
      Arr.map(messages, (message) =>
        message.role === "tool"
          ? expect.objectContaining({
              content: [
                expect.objectContaining({
                  output: { type: "text", value: evidence },
                }),
              ],
            })
          : message
      )
    );
  });

  it("splits a flat run of messages into whole turns and drops the tail of a cut turn", () => {
    const cut: ModelMessage = {
      role: "assistant",
      content: "Tail of a turn the fetch window cut",
    };
    expect(splitTurns([cut, ...turn("First"), ...turn("Second")])).toEqual([
      turn("First"),
      turn("Second"),
    ]);
    expect(splitTurns([cut])).toEqual([]);
  });
});

describe("Nina newest askings", () => {
  const ask = (order: number, retryOf?: number) =>
    retryOf === undefined ? { order } : { order, retryOf };

  it("keeps the newest asking of each question, whichever asking a retry named", () => {
    // Orders 1 and 3 ask the question of order 0 again, and order 2 asks another.
    expect(newestAskings([ask(0), ask(1, 0), ask(2), ask(3, 0)], [])).toEqual([
      ask(2),
      ask(3, 0),
    ]);
  });

  it("lets a later turn take its question from the turns before it", () => {
    expect(newestAskings([ask(0), ask(1)], [ask(2, 0)])).toEqual([ask(1)]);
  });
});
