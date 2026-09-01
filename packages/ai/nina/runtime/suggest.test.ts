// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { suggestionGenerationTimeout } from "@repo/ai/config/timeouts";
import { writeNinaSuggestions } from "@repo/ai/nina/runtime/suggest";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { ModelMessage, UIMessageStreamWriter } from "ai";
import { streamText } from "ai";
import { Effect, Result, Stream } from "effect";

const streamTextMock = vi.hoisted(() => vi.fn());

vi.mock("ai", { spy: true });
vi.mocked(streamText).mockImplementation(streamTextMock);

vi.mock("@repo/ai/config/app", () => ({
  provider: {
    languageModel: (modelId: string) => modelId,
  },
}));
const messages = [
  {
    content: "Halo Nina.",
    role: "user",
  },
] satisfies ModelMessage[];
/** Creates an Effect-backed async iterable that emits suggestion partials. */
function suggestionPartials(
  chunks: readonly {
    readonly suggestions?: readonly string[];
  }[]
) {
  return Stream.fromIterable(chunks).pipe(Stream.toAsyncIterable);
}
/** Creates an Effect-backed async iterable that fails while Nina reads it. */
function failingSuggestionPartials() {
  return Stream.fail(new Error("partial stream failed")).pipe(
    Stream.toAsyncIterable
  );
}
/** Captures suggestion data parts written by the Nina suggestion Module. */
function createWriter() {
  return {
    merge: vi.fn(),
    onError: undefined,
    write: vi.fn(),
  } satisfies UIMessageStreamWriter<MyUIMessage>;
}
describe("nina/runtime/suggest", () => {
  beforeEach(() => {
    streamTextMock.mockReset();
  });
  it.effect("writes final suggestions when partial chunks are empty", () =>
    Effect.gen(function* () {
      const writer = createWriter();
      streamTextMock.mockReturnValue({
        output: Promise.resolve({
          suggestions: ["Apa contoh lainnya?", "Beri latihan singkat."],
        }),
        partialOutputStream: suggestionPartials([{}, { suggestions: [] }]),
      });
      yield* writeNinaSuggestions({
        locale: "id",
        messages,
        writer,
      });
      expect(writer.write).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "data-suggestions",
          data: {
            data: ["Apa contoh lainnya?", "Beri latihan singkat."],
          },
        })
      );
    })
  );
  it.effect(
    "prunes tool-call parts and ends the suggestion request with a user turn",
    () =>
      Effect.gen(function* () {
        const writer = createWriter();
        const transcriptWithToolCall = [
          {
            content: "Hitung 2 + 3.",
            role: "user",
          },
          {
            content: [
              {
                text: "Saya cek hitungannya.",
                type: "text",
              },
              {
                input: { expression: "2+3" },
                toolCallId: "tool-1",
                toolName: "math",
                type: "tool-call",
              },
            ],
            role: "assistant",
          },
          {
            content: [
              {
                output: { type: "text", value: "5" },
                toolCallId: "tool-1",
                toolName: "math",
                type: "tool-result",
              },
            ],
            role: "tool",
          },
          {
            content: "Karena dua benda ditambah tiga benda menjadi lima benda.",
            role: "assistant",
          },
        ] satisfies ModelMessage[];
        streamTextMock.mockReturnValue({
          output: Promise.resolve({
            suggestions: ["Beri contoh benda nyata."],
          }),
          partialOutputStream: suggestionPartials([]),
        });
        yield* writeNinaSuggestions({
          locale: "id",
          messages: transcriptWithToolCall,
          writer,
        });
        expect(streamTextMock).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              { content: "Hitung 2 + 3.", role: "user" },
              {
                content: [
                  {
                    text: "Saya cek hitungannya.",
                    type: "text",
                  },
                ],
                role: "assistant",
              },
              {
                content:
                  "Karena dua benda ditambah tiga benda menjadi lima benda.",
                role: "assistant",
              },
              {
                content: "Generate the requested follow-up suggestions now.",
                role: "user",
              },
            ],
            timeout: suggestionGenerationTimeout,
          })
        );
      })
  );
  it.effect(
    "updates the same suggestions part when final output completes",
    () =>
      Effect.gen(function* () {
        const writer = createWriter();
        streamTextMock.mockReturnValue({
          output: Promise.resolve({
            suggestions: ["Apa contoh finalnya?", "Buat latihan final."],
          }),
          partialOutputStream: suggestionPartials([
            { suggestions: [] },
            { suggestions: ["Apa langkah berikutnya?"] },
          ]),
        });
        yield* writeNinaSuggestions({
          locale: "id",
          messages,
          writer,
        });
        expect(writer.write).toHaveBeenCalledTimes(2);
        const firstWrite = writer.write.mock.calls[0]?.[0];
        const finalWrite = writer.write.mock.calls[1]?.[0];
        expect(firstWrite).toEqual(
          expect.objectContaining({
            data: {
              data: ["Apa langkah berikutnya?"],
            },
          })
        );
        expect(finalWrite).toEqual(
          expect.objectContaining({
            id: firstWrite?.id,
            data: {
              data: ["Apa contoh finalnya?", "Buat latihan final."],
            },
          })
        );
      })
  );
  it.effect(
    "skips writing when the completed suggestions object is empty",
    () =>
      Effect.gen(function* () {
        const writer = createWriter();
        streamTextMock.mockReturnValue({
          output: Promise.resolve({
            suggestions: [],
          }),
          partialOutputStream: suggestionPartials([{}]),
        });
        yield* writeNinaSuggestions({
          locale: "id",
          messages,
          writer,
        });
        expect(writer.write).not.toHaveBeenCalled();
      })
  );
  it.effect(
    "reports a typed failure when partial suggestion streaming fails",
    () =>
      Effect.gen(function* () {
        const writer = createWriter();
        streamTextMock.mockReturnValue({
          output: Promise.resolve({
            suggestions: ["Tidak dipakai."],
          }),
          partialOutputStream: failingSuggestionPartials(),
        });
        const result = yield* Effect.result(
          writeNinaSuggestions({
            locale: "id",
            messages,
            writer,
          })
        );
        expect(Result.isFailure(result)).toBe(true);
        expect(Result.getFailure(result)).toMatchObject({
          _tag: "Some",
          value: {
            _tag: "NinaSuggestionError",
            message: "Failed to stream Nina suggestions.",
          },
        });
      })
  );
  it.effect(
    "reports a typed failure when final suggestion completion fails",
    () =>
      Effect.gen(function* () {
        const writer = createWriter();
        streamTextMock.mockReturnValue({
          output: Promise.reject(new Error("completion failed")),
          partialOutputStream: suggestionPartials([{}]),
        });
        const result = yield* Effect.result(
          writeNinaSuggestions({
            locale: "id",
            messages,
            writer,
          })
        );
        expect(Result.isFailure(result)).toBe(true);
        expect(Result.getFailure(result)).toMatchObject({
          _tag: "Some",
          value: {
            _tag: "NinaSuggestionError",
            message: "Failed to complete Nina suggestions.",
          },
        });
      })
  );
});
