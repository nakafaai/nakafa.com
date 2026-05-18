import { DEFAULT_TITLE, MAX_TITLE_LENGTH } from "@repo/ai/features/constants";
import { generateTitle } from "@repo/ai/features/title";
import type { MyUIMessage } from "@repo/ai/types/message";
import { generateText } from "ai";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/ai/config/vercel", () => ({
  model: {
    languageModel: (modelId: string) => modelId,
  },
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();

  return {
    ...actual,
    generateText: vi.fn(),
  };
});

const mockedGenerateText = vi.mocked(generateText);

afterEach(() => {
  mockedGenerateText.mockReset();
});

describe("generateTitle", () => {
  it("summarizes the first user message without assistant internals", async () => {
    mockedGenerateText.mockResolvedValue({
      text: "Latihan Matriks Eigen",
    } as Awaited<ReturnType<typeof generateText>>);

    await Effect.runPromise(
      generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: "nakafa-lite" },
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
            metadata: { model: "nakafa-lite" },
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

    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Cek apakah matriks ini bisa didiagonalkan.",
      })
    );
    expect(mockedGenerateText).not.toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Internal reasoning"),
      })
    );
  });

  it("removes surrounding title quotes", async () => {
    mockedGenerateText.mockResolvedValue({
      text: '"Belajar Fungsi Kuadrat"',
    } as Awaited<ReturnType<typeof generateText>>);

    const title = await Effect.runPromise(
      generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: "nakafa-lite" },
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
    mockedGenerateText.mockResolvedValue({
      text: "Analisis Persamaan Diferensial Linear Orde Dua Homogen dengan Koefisien Variabel dan Kondisi Awal",
    } as Awaited<ReturnType<typeof generateText>>);

    const title = await Effect.runPromise(
      generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: "nakafa-lite" },
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
    mockedGenerateText.mockRejectedValue(new Error("model unavailable"));

    const title = await Effect.runPromise(
      generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: "nakafa-lite" },
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
    mockedGenerateText.mockResolvedValue({
      text: "Obrolan Baru",
    } as Awaited<ReturnType<typeof generateText>>);

    await Effect.runPromise(
      generateTitle({
        messages: [
          {
            id: "assistant-1",
            metadata: { model: "nakafa-lite" },
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

    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "",
      })
    );
  });

  it("ignores non-text user parts when building the title prompt", async () => {
    mockedGenerateText.mockResolvedValue({
      text: "Latihan Kombinatorika",
    } as Awaited<ReturnType<typeof generateText>>);

    await Effect.runPromise(
      generateTitle({
        messages: [
          {
            id: "user-1",
            metadata: { model: "nakafa-lite" },
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

    expect(mockedGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Bantu cek kombinatorika ini.",
      })
    );
  });
});
