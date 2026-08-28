import { it as effectIt } from "@effect/vitest";
import { makeQuranFixture } from "@repo/ai/agents/nakafa/tools/fixture";
import { createNakafaTestService } from "@repo/ai/agents/nakafa/tools/test";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa Quran AI fixtures", () => {
  const meaningByLocale = {
    de: "Die Eröffnende",
    en: "The Opening",
    id: "Pembuka",
  } as const;

  it.each([
    ["en", "quranenc-english", "mokhtasar-english", "external"],
    ["id", "quranenc-indonesian", "quranenc-tafsir", "embedded"],
    ["de", "quranenc-german", "mokhtasar-german", "external"],
  ] as const)(
    "builds exact %s source relationships",
    (locale, translationId, tafsirId, kind) => {
      const result = makeQuranFixture({
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
      expect(result.meaning.locale).toBe(locale);
      expect(result.meaning.text).toBe(meaningByLocale[locale]);
      expect(result.verses[0]?.tafsir).toBe(
        locale === "id" ? "Tafsir from the injected test adapter." : undefined
      );
    }
  );

  effectIt.effect("exposes one canonical source-grounded service", () =>
    Effect.gen(function* () {
      const service = createNakafaTestService();
      const [reference, interpreted, missing, invalid] = yield* Effect.all([
        service.quran({ locale: "de", surah: 1 }),
        service.quran({ include_tafsir: true, locale: "id", surah: 1 }),
        service.quran({ from_verse: 999, locale: "en", surah: 1 }),
        Effect.result(service.quran({ locale: "en", surah: 999 })),
      ]);

      expect(Option.getOrUndefined(reference)?.sources.translation.id).toBe(
        "quranenc-german"
      );
      expect(
        Option.getOrUndefined(interpreted)?.verses[0]?.tafsir
      ).toBeTruthy();
      expect(Option.isNone(missing)).toBe(true);
      expect(invalid._tag).toBe("Failure");
    })
  );
});
