// @vitest-environment node

import { writeNinaSuggestions } from "@repo/ai/nina/runtime/suggest";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { ModelMessage, UIMessageStreamWriter } from "ai";
import { Effect, Either } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const streamText = vi.hoisted(() => vi.fn());

vi.mock("@repo/ai/config/app", () => ({
  provider: {
    languageModel: (modelId: string) => modelId,
  },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    streamText,
  };
});

const messages = [
  {
    content: "Halo Nina.",
    role: "user",
  },
] satisfies ModelMessage[];

/** Creates an async iterable that emits the provided suggestion partials. */
async function* suggestionPartials(
  chunks: readonly { readonly suggestions?: readonly string[] }[]
) {
  for (const chunk of chunks) {
    await Promise.resolve();
    yield chunk;
  }
}

/** Creates an async iterable that fails while Nina reads streamed suggestions. */
async function* failingSuggestionPartials() {
  await Promise.resolve();
  yield await Promise.reject(new Error("partial stream failed"));
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
    streamText.mockReset();
  });

  it("writes final suggestions when partial chunks are empty", async () => {
    const writer = createWriter();
    streamText.mockReturnValue({
      output: Promise.resolve({
        suggestions: ["Apa contoh lainnya?", "Beri latihan singkat."],
      }),
      partialOutputStream: suggestionPartials([{}, { suggestions: [] }]),
    });

    await Effect.runPromise(
      writeNinaSuggestions({
        locale: "id",
        messages,
        writer,
      })
    );

    expect(writer.write).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "data-suggestions",
        data: {
          data: ["Apa contoh lainnya?", "Beri latihan singkat."],
        },
      })
    );
  });

  it("updates the same suggestions part when final output completes", async () => {
    const writer = createWriter();
    streamText.mockReturnValue({
      output: Promise.resolve({
        suggestions: ["Apa contoh finalnya?", "Buat latihan final."],
      }),
      partialOutputStream: suggestionPartials([
        { suggestions: [] },
        { suggestions: ["Apa langkah berikutnya?"] },
      ]),
    });

    await Effect.runPromise(
      writeNinaSuggestions({
        locale: "id",
        messages,
        writer,
      })
    );

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
  });

  it("skips writing when the completed suggestions object is empty", async () => {
    const writer = createWriter();
    streamText.mockReturnValue({
      output: Promise.resolve({
        suggestions: [],
      }),
      partialOutputStream: suggestionPartials([{}]),
    });

    await Effect.runPromise(
      writeNinaSuggestions({
        locale: "id",
        messages,
        writer,
      })
    );

    expect(writer.write).not.toHaveBeenCalled();
  });

  it("reports a typed failure when partial suggestion streaming fails", async () => {
    const writer = createWriter();
    streamText.mockReturnValue({
      output: Promise.resolve({
        suggestions: ["Tidak dipakai."],
      }),
      partialOutputStream: failingSuggestionPartials(),
    });

    const result = await Effect.runPromise(
      Effect.either(
        writeNinaSuggestions({
          locale: "id",
          messages,
          writer,
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(Either.getLeft(result)).toMatchObject({
      _tag: "Some",
      value: {
        _tag: "NinaSuggestionError",
        message: "Failed to stream Nina suggestions.",
      },
    });
  });

  it("reports a typed failure when final suggestion completion fails", async () => {
    const writer = createWriter();
    streamText.mockReturnValue({
      output: Promise.reject(new Error("completion failed")),
      partialOutputStream: suggestionPartials([{}]),
    });

    const result = await Effect.runPromise(
      Effect.either(
        writeNinaSuggestions({
          locale: "id",
          messages,
          writer,
        })
      )
    );

    expect(Either.isLeft(result)).toBe(true);
    expect(Either.getLeft(result)).toMatchObject({
      _tag: "Some",
      value: {
        _tag: "NinaSuggestionError",
        message: "Failed to complete Nina suggestions.",
      },
    });
  });
});
