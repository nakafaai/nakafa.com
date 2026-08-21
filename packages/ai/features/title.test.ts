import { ModelIdSchema } from "@repo/ai/config/model";
import { DEFAULT_TITLE, MAX_TITLE_LENGTH } from "@repo/ai/features/constants";
import { generateTitle } from "@repo/ai/features/title";
import type { MyUIMessage } from "@repo/ai/types/message";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";

const generateText = vi.hoisted(() => vi.fn());
const modelId = ModelIdSchema.make("nakafa-lite");

vi.mock("@repo/ai/config/app", () => ({
  provider: {
    languageModel: (modelId: string) => modelId,
  },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    generateText,
  };
});

afterEach(() => {
  generateText.mockReset();
});

describe("generateTitle", () => {
  it.live("summarizes the first user message without assistant internals", () =>
    Effect.gen(function* () {
      generateText.mockResolvedValue({
        text: "Latihan Matriks Eigen",
      });

      yield* generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: modelId },
            parts: [
              {
                text: "Cek apakah matriks ini bisa didiagonalkan.",
                type: "text",
              },
            ],
            role: "user",
          },
          {
            id: "assistant-1",
            metadata: { model: modelId },
            parts: [
              {
                text: "Internal reasoning that should not title the chat.",
                type: "reasoning",
              },
            ],
            role: "assistant",
          },
        ] satisfies MyUIMessage[],
      });

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Cek apakah matriks ini bisa didiagonalkan.",
        })
      );
      expect(generateText).not.toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Internal reasoning"),
        })
      );
    })
  );

  it.live("removes surrounding title quotes", () =>
    Effect.gen(function* () {
      generateText.mockResolvedValue({
        text: '"Belajar Fungsi Kuadrat"',
      });

      const title = yield* generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: modelId },
            parts: [
              {
                text: "Jelaskan fungsi kuadrat.",
                type: "text",
              },
            ],
            role: "user",
          },
        ] satisfies MyUIMessage[],
      });

      expect(title).toBe("Belajar Fungsi Kuadrat");
    })
  );

  it.live("truncates long generated titles", () =>
    Effect.gen(function* () {
      generateText.mockResolvedValue({
        text: "Analisis Persamaan Diferensial Linear Orde Dua Homogen dengan Koefisien Variabel dan Kondisi Awal",
      });

      const title = yield* generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: modelId },
            parts: [
              {
                text: "Bantu analisis persamaan diferensial ini.",
                type: "text",
              },
            ],
            role: "user",
          },
        ] satisfies MyUIMessage[],
      });

      expect(title).toHaveLength(MAX_TITLE_LENGTH);
      expect(title.endsWith("...")).toBe(true);
    })
  );

  it.live("falls back when generation fails", () =>
    Effect.gen(function* () {
      generateText.mockRejectedValue(new Error("model unavailable"));

      const title = yield* generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: modelId },
            parts: [
              {
                text: "Buatkan latihan peluang.",
                type: "text",
              },
            ],
            role: "user",
          },
        ] satisfies MyUIMessage[],
      });

      expect(title).toBe(DEFAULT_TITLE);
    })
  );

  it.live("uses an empty title prompt when no user text exists", () =>
    Effect.gen(function* () {
      generateText.mockResolvedValue({
        text: "Obrolan Baru",
      });

      yield* generateTitle({
        messages: [
          {
            id: "assistant-1",
            metadata: { model: modelId },
            parts: [
              {
                text: "Assistant-only content.",
                type: "text",
              },
            ],
            role: "assistant",
          },
        ] satisfies MyUIMessage[],
      });

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "",
        })
      );
    })
  );

  it.live("ignores non-text user parts when building the title prompt", () =>
    Effect.gen(function* () {
      generateText.mockResolvedValue({
        text: "Latihan Kombinatorika",
      });

      yield* generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: modelId },
            parts: [
              {
                mediaType: "image/png",
                type: "file",
                url: "https://example.com/image.png",
              },
              {
                text: "Bantu cek kombinatorika ini.",
                type: "text",
              },
            ],
            role: "user",
          },
        ] satisfies MyUIMessage[],
      });

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Bantu cek kombinatorika ini.",
        })
      );
    })
  );
});
