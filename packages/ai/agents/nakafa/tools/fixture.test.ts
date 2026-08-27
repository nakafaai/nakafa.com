import { it as effectIt } from "@effect/vitest";
import { makeQuranV2Fixture } from "@repo/ai/agents/nakafa/tools/fixture";
import { createNakafaTestService } from "@repo/ai/agents/nakafa/tools/test";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa Quran V2 AI fixtures", () => {
  it.each([
    ["en", "quranenc-english", "mokhtasar-english", "external"],
    ["id", "quranenc-indonesian", "quranenc-tafsir", "embedded"],
    ["de", "quranenc-german", "mokhtasar-german", "external"],
  ] as const)(
    "builds exact %s source relationships",
    (locale, translationId, tafsirId, kind) => {
      const result = makeQuranV2Fixture({
        from_verse: 1,
        include_tafsir: true,
        locale,
        surah: 1,
      });

      expect(result.sources.translation.id).toBe(translationId);
      expect(result.tafsir_access).toMatchObject({
        kind,
        locale,
        source: { id: tafsirId },
      });
      expect(result.meaning).toEqual(
        locale === "en" ? { locale: "en", text: "The Opening" } : null
      );
      expect(result.verses[0]?.tafsir).toBe(
        locale === "id" ? "Tafsir from the injected test adapter." : undefined
      );
    }
  );

  effectIt.effect(
    "retains the injected V1 service for compatibility consumers",
    () =>
      Effect.gen(function* () {
        const service = createNakafaTestService();
        const [plain, interpreted, missing, invalid] = yield* Effect.all([
          service.quran({ include_tafsir: false, locale: "en", surah: 1 }),
          service.quran({ include_tafsir: true, locale: "id", surah: 1 }),
          service.quran({ from_verse: 999, locale: "en", surah: 1 }),
          Effect.result(service.quran({ locale: "en", surah: 999 })),
        ]);

        expect(Option.getOrUndefined(plain)?.verses[0]?.tafsir).toBeUndefined();
        expect(
          Option.getOrUndefined(interpreted)?.verses[0]?.tafsir
        ).toBeTruthy();
        expect(Option.isNone(missing)).toBe(true);
        expect(invalid._tag).toBe("Failure");
      })
  );

  effectIt.effect(
    "exposes the explicit V2 service without switching V1 consumers",
    () =>
      Effect.gen(function* () {
        const service = createNakafaTestService();
        const [reference, missing, invalid] = yield* Effect.all([
          service.quranV2({ locale: "de", surah: 1 }),
          service.quranV2({ from_verse: 999, locale: "en", surah: 1 }),
          Effect.result(service.quranV2({ locale: "en", surah: 999 })),
        ]);

        expect(Option.getOrUndefined(reference)?.sources.translation.id).toBe(
          "quranenc-german"
        );
        expect(Option.isNone(missing)).toBe(true);
        expect(invalid._tag).toBe("Failure");
      })
  );
});
