import { describe, expect, it } from "vitest";
import { generateFallbackMetadata } from "@/lib/utils/seo/fallback";

describe("generateFallbackMetadata", () => {
  it("uses material source context for subject content fallback", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "material-lesson",
          category: "high-school",
          grade: "11",
          material: "mathematics",
          data: {
            title: "Trigonometric Function Graph",
            description: "Graph lesson fallback.",
          },
        },
        "en"
      )
    ).toStrictEqual({
      title: "Trigonometric Function Graph - mathematics - Nakafa",
      description: "Graph lesson fallback. Trigonometric Function Graph",
      keywords: [],
    });
  });

  it("uses article category context for article fallback", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "article",
          category: "politics",
          data: {
            title: "Regional Elections",
            description: "Article fallback.",
          },
        },
        "en"
      )
    ).toStrictEqual({
      title: "Regional Elections - politics - Nakafa",
      description: "Article fallback. Regional Elections",
      keywords: [],
    });
  });

  it("uses curriculum program context when a title is unavailable", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "curriculum-context",
          level: "track",
          program: "Kurikulum Merdeka",
          data: {
            description: "Curriculum fallback.",
          },
        },
        "en"
      )
    ).toStrictEqual({
      title: "Kurikulum Merdeka - Nakafa",
      description: "Curriculum fallback.",
      keywords: [],
    });
  });

  it("uses curriculum program context with the content title", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "curriculum-context",
          level: "subject",
          program: "Kurikulum Merdeka",
          data: {
            title: "Biologi",
          },
        },
        "en"
      )
    ).toStrictEqual({
      title: "Biologi - Kurikulum Merdeka - Nakafa",
      description: "Biologi",
      keywords: [],
    });
  });

  it("uses curriculum parent context when program context is unavailable", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "curriculum-context",
          level: "class",
          parent: "Kurikulum Merdeka",
          data: {
            title: "Kelas 10",
          },
        },
        "en"
      )
    ).toStrictEqual({
      title: "Kelas 10 - Kurikulum Merdeka - Nakafa",
      description: "Kelas 10",
      keywords: [],
    });
  });

  it("falls back to the site title when curriculum context is empty", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "curriculum-context",
          level: "track",
          data: {},
        },
        "en"
      )
    ).toStrictEqual({
      title: "Nakafa",
      description: "",
      keywords: [],
    });
  });

  it("uses the requested Quran translation for Quran fallback", () => {
    expect(
      generateFallbackMetadata(
        {
          type: "quran",
          surah: {
            name: {
              long: "الفاتحة",
              short: "Al-Fatihah",
              translation: { en: "The Opening", id: "Pembukaan" },
              transliteration: { en: "Al-Fatihah", id: "Al-Fatihah" },
            },
            number: 1,
            numberOfVerses: 7,
            preBismillah: null,
            revelation: { arab: "مكة", en: "Meccan", id: "Makkiyah" },
            sequence: 5,
          },
        },
        "id"
      )
    ).toStrictEqual({
      title: "Pembukaan - Nakafa",
      description: "Pembukaan",
      keywords: [],
    });
  });
});
