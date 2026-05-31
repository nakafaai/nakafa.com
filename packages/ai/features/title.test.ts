import { ModelIdSchema } from "@repo/ai/config/model";
import { DEFAULT_TITLE, MAX_TITLE_LENGTH } from "@repo/ai/features/constants";
import { generateTitle } from "@repo/ai/features/title";
import type { MyUIMessage } from "@repo/ai/types/message";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("summarizes the first user message without assistant internals", async () => {
    generateText.mockResolvedValue({
      text: "Latihan Matriks Eigen",
    });

    await Effect.runPromise(
      generateTitle({
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
      })
    );

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
  });

  it("removes surrounding title quotes", async () => {
    generateText.mockResolvedValue({
      text: '"Belajar Fungsi Kuadrat"',
    });

    const title = await Effect.runPromise(
      generateTitle({
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
      })
    );

    expect(title).toBe("Belajar Fungsi Kuadrat");
  });

  it("truncates long generated titles", async () => {
    generateText.mockResolvedValue({
      text: "Analisis Persamaan Diferensial Linear Orde Dua Homogen dengan Koefisien Variabel dan Kondisi Awal",
    });

    const title = await Effect.runPromise(
      generateTitle({
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
      })
    );

    expect(title).toHaveLength(MAX_TITLE_LENGTH);
    expect(title.endsWith("...")).toBe(true);
  });

  it("falls back when generation fails", async () => {
    generateText.mockRejectedValue(new Error("model unavailable"));

    const title = await Effect.runPromise(
      generateTitle({
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
      })
    );

    expect(title).toBe(DEFAULT_TITLE);
  });

  it("uses an empty title prompt when no user text exists", async () => {
    generateText.mockResolvedValue({
      text: "Obrolan Baru",
    });

    await Effect.runPromise(
      generateTitle({
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
      })
    );

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "",
      })
    );
  });

  it("ignores non-text user parts when building the title prompt", async () => {
    generateText.mockResolvedValue({
      text: "Latihan Kombinatorika",
    });

    await Effect.runPromise(
      generateTitle({
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
      })
    );

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Bantu cek kombinatorika ini.",
      })
    );
  });
});
