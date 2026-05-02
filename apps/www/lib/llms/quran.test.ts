import { describe, expect, it } from "vitest";
import { getQuranLlmsText, getQuranRouteMetadata } from "@/lib/llms/quran";

describe("quran llms text", () => {
  it("builds quran route metadata for list, known surah, and unknown surah routes", () => {
    expect(getQuranRouteMetadata({ locale: "en", route: "/quran" })).toEqual({
      description: "List of all 114 Surahs in the Holy Quran.",
      hasMarkdown: true,
      title: "Al-Quran",
    });

    expect(
      getQuranRouteMetadata({ locale: "id", route: "/quran/1" })
    ).toMatchObject({
      hasMarkdown: true,
      title: "1. Al-Fatihah",
    });

    expect(
      getQuranRouteMetadata({ locale: "en", route: "/quran/999" })
    ).toEqual({
      description: undefined,
      hasMarkdown: false,
      title: "999",
    });
  });

  it("returns null for non-quran and malformed quran markdown routes", () => {
    expect(
      getQuranLlmsText({
        cleanSlug: "articles/politics/dynastic-politics-asian-values",
        locale: "en",
      })
    ).toBe(null);
    expect(getQuranLlmsText({ cleanSlug: "quran/1/extra", locale: "en" })).toBe(
      null
    );
    expect(
      getQuranLlmsText({ cleanSlug: "quran/not-a-number", locale: "en" })
    ).toBe(null);
    expect(getQuranLlmsText({ cleanSlug: "quran/999", locale: "en" })).toBe(
      null
    );
  });

  it("builds quran index and surah markdown with localized translations", () => {
    const indexText = getQuranLlmsText({ cleanSlug: "quran", locale: "en" });
    const firstSurahText = getQuranLlmsText({
      cleanSlug: "quran/1",
      locale: "en",
    });
    const secondSurahText = getQuranLlmsText({
      cleanSlug: "quran/2",
      locale: "id",
    });

    expect(indexText).toContain("## 1. Al-Faatiha");
    expect(firstSurahText).toContain("### Verses");
    expect(firstSurahText).toContain("#### Verse 1");
    expect(secondSurahText).toContain("### Pre-Bismillah");
    expect(secondSurahText).toContain("**Translation:**");
  });
});
