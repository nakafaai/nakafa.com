import { afterEach, describe, expect, it } from "@effect/vitest";
import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { quran } from "@repo/backend/confect/nina/nakafa/tools/quran";
import { makeQuranFixture } from "@repo/backend/test/nina/quran";
import {
  recordProgress,
  runSpecialist,
} from "@repo/backend/test/nina/specialist";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Array as Arr, Effect, MutableList, Option } from "effect";

vi.mock("@repo/backend/agent/quran", () => ({
  getNakafaQuranReference: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

describe("Nina Quran evidence", () => {
  it.each([false, true])(
    "preserves tafsir selection %s and applies the authenticated turn locale",
    async (includeTafsir) => {
      vi.mocked(getNakafaQuranReference).mockReturnValue(
        Effect.succeed(
          makeQuranFixture({
            locale: "id",
            from_verse: 1,
            surah: 1,
            include_tafsir: includeTafsir,
          })
        )
      );
      const { artifacts, publish } = recordProgress();
      const input = includeTafsir
        ? {
            surah: 1,
            include_tafsir: true,
            from_verse: 1,
            to_verse: 1,
            locale: "en" as const,
          }
        : { surah: 1 };
      const text = await runSpecialist(() =>
        quran({ input, locale: "id", publish, toolCallId: "quran" })
      );
      expect(text).toContain("# Nakafa Quran Reference");
      expect(
        Option.getOrThrow(Arr.last(MutableList.toArray(artifacts)))
      ).toMatchObject({
        data: {
          status: "done",
          result: { verse_count: 1 },
          input: { locale: "id", include_tafsir: includeTafsir, from_verse: 1 },
        },
      });
      expect(getNakafaQuranReference).toHaveBeenCalledWith(
        expect.objectContaining({ locale: "id" })
      );
    }
  );
  it.each([
    [{ surah: 1, from_verse: 2, to_verse: 1 }, "Invalid Quran verse range."],
    [
      { surah: 2, from_verse: 1, to_verse: 21 },
      "Quran reference range is too large.",
    ],
  ] as const)(
    "rejects an unsafe verse range before reading content",
    async (input, message) => {
      const { artifacts, publish } = recordProgress();
      expect(
        await runSpecialist(() =>
          quran({ input, locale: "en", publish, toolCallId: "quran" })
        )
      ).toBe(message);
      expect(getNakafaQuranReference).not.toHaveBeenCalled();
      expect(
        Option.getOrThrow(Arr.last(MutableList.toArray(artifacts)))
      ).toMatchObject({
        data: { status: "error", error: message },
      });
    }
  );
  it("publishes the typed content failure", async () => {
    vi.mocked(getNakafaQuranReference).mockReturnValue(
      Effect.fail(
        new NakafaAgentDataReadError({ message: "Reference is unavailable." })
      )
    );
    const { artifacts, publish } = recordProgress();
    expect(
      await runSpecialist(() =>
        quran({
          input: { surah: 1 },
          locale: "en",
          publish,
          toolCallId: "quran",
        })
      )
    ).toBe("Reference is unavailable.");
    expect(
      Option.getOrThrow(Arr.last(MutableList.toArray(artifacts)))
    ).toMatchObject({
      data: { status: "error", error: "Reference is unavailable." },
    });
  });
});
