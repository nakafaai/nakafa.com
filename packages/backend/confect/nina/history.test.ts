import { describe, expect, it } from "@effect/vitest";
import {
  boundHistory,
  NinaContextLimitError,
} from "@repo/backend/confect/nina/history";
import type { ModelMessage } from "ai";
import { Effect, Result } from "effect";

describe("Nina provider context", () => {
  it.effect(
    "projects validated evidence without changing the permanent transcript or losing tool pairs",
    () =>
      Effect.gen(function* () {
        const messages: ModelMessage[] = [
          { role: "user", content: "Explain the current page" },
          {
            role: "assistant",
            content: [
              { type: "reasoning", text: "Private chain" },
              {
                type: "tool-call",
                toolCallId: "read-1",
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
                toolCallId: "read-1",
                toolName: "nakafa",
                output: {
                  type: "json",
                  value: {
                    text: "Evidence with [source](https://example.com).",
                    artifacts: [
                      {
                        id: "read-1",
                        type: "data-nakafa",
                        data: {
                          kind: "content",
                          status: "error",
                          input: { content_ref: "https://nakafa.com/en/home" },
                          error: "Unavailable",
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ];
        const before = JSON.stringify(messages);
        const result = yield* boundHistory(messages);
        expect(JSON.stringify(messages)).toBe(before);
        expect(result[1]).toMatchObject({
          role: "assistant",
          content: [{ type: "tool-call", toolCallId: "read-1" }],
        });
        expect(result[2]).toEqual({
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "read-1",
              toolName: "nakafa",
              output: {
                type: "text",
                value: "Evidence with [source](https://example.com).",
              },
            },
          ],
        });
      })
  );

  it.effect(
    "prunes unavailable tools while retaining current tool evidence",
    () =>
      Effect.gen(function* () {
        const messages: ModelMessage[] = [
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "foreign",
                toolName: "foreign",
                output: { type: "json", value: { result: true } },
              },
              {
                type: "tool-result",
                toolCallId: "math",
                toolName: "math",
                output: { type: "text", value: "2" },
              },
            ],
          },
        ];
        expect(yield* boundHistory(messages)).toEqual([
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "math",
                toolName: "math",
                output: { type: "text", value: "2" },
              },
            ],
          },
        ]);
      })
  );

  it.effect(
    "compacts validated evidence from any recorded Nina capability",
    () =>
      Effect.gen(function* () {
        const result = yield* boundHistory([
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "search-1",
                toolName: "search",
                output: {
                  type: "json",
                  value: { text: "Recorded search evidence", artifacts: [] },
                },
              },
            ],
          },
        ]);
        expect(result).toEqual([
          { role: "assistant", content: "Recorded search evidence" },
        ]);
      })
  );

  it.effect(
    "removes unavailable call pairs without moving evidence into another turn",
    () =>
      Effect.gen(function* () {
        const messages: ModelMessage[] = [
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
            ],
          },
          { role: "assistant", content: "The result is -2" },
          { role: "user", content: "Explain the result" },
        ];
        const before = JSON.stringify(messages);
        expect(yield* boundHistory(messages)).toEqual([
          messages[0],
          { role: "assistant", content: "Verified determinant: -2" },
          messages[3],
          messages[4],
        ]);
        expect(JSON.stringify(messages)).toBe(before);
      })
  );

  it.effect(
    "rejects corrupt Nina evidence instead of silently dropping its fields",
    () =>
      Effect.gen(function* () {
        const result = yield* boundHistory([
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "bad",
                toolName: "math",
                output: { type: "json", value: { text: 42 } },
              },
            ],
          },
        ]).pipe(Effect.result);
        expect(result).toEqual(
          Result.fail(
            new NinaContextLimitError({
              message: "Stored Nina evidence does not satisfy its contract.",
            })
          )
        );
      })
  );

  it.effect(
    "removes whole older turns when the message or token budget is reached",
    () =>
      Effect.gen(function* () {
        const messages: ModelMessage[] = Array.from(
          { length: 26 },
          (_, order): ModelMessage[] => [
            { role: "user", content: `Question ${order}` },
            { role: "assistant", content: `Answer ${order}` },
          ]
        ).flat();
        const result = yield* boundHistory(messages);
        expect(result).toHaveLength(50);
        expect(result[0]).toEqual({ role: "user", content: "Question 1" });
        expect(result.at(-1)).toEqual({
          role: "assistant",
          content: "Answer 25",
        });
        const newest: ModelMessage = {
          role: "user",
          content: "Keep the latest question",
        };
        expect(
          yield* boundHistory([
            { role: "user", content: "unbounded ".repeat(26_000) },
            { role: "assistant", content: "Old answer" },
            newest,
          ])
        ).toEqual([newest]);
      })
  );

  it.effect(
    "fails explicitly when the latest turn alone exceeds the token budget",
    () =>
      Effect.gen(function* () {
        const result = yield* boundHistory([
          { role: "user", content: "unbounded ".repeat(26_000) },
        ]).pipe(Effect.result);
        expect(result).toEqual(
          Result.fail(
            new NinaContextLimitError({
              message:
                "The latest prompt and its evidence exceed Nina's context limit.",
            })
          )
        );
      })
  );
});
