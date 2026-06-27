import { describe, expect, it } from "vitest";
import { generateFallbackMetadata } from "@/lib/utils/seo/fallback";

describe("generateFallbackMetadata", () => {
  it("uses material source context for subject content fallback", () => {
    expect(
      generateFallbackMetadata({
        type: "material-lesson",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {
          title: "Trigonometric Function Graph",
          description: "Graph lesson fallback.",
        },
      })
    ).toStrictEqual({
      title: "Trigonometric Function Graph - mathematics - Nakafa",
      description: "Graph lesson fallback. Trigonometric Function Graph",
      keywords: [],
    });
  });

  it("uses exercise material context for practice fallback", () => {
    expect(
      generateFallbackMetadata({
        type: "exercise",
        category: "high-school",
        exam: "snbt",
        material: "quantitative-knowledge",
        data: {
          title: "Question 9",
          description: "Exercise fallback.",
        },
      })
    ).toStrictEqual({
      title: "Question 9 - quantitative-knowledge - Nakafa",
      description: "Exercise fallback. Question 9",
      keywords: [],
    });
  });

  it("uses the assessment key as the fallback display context", () => {
    expect(
      generateFallbackMetadata({
        type: "exercise-program",
        category: "high-school",
        exam: "snbt",
        data: {
          title: "SNBT",
          description: "Assessment fallback.",
        },
      })
    ).toStrictEqual({
      title: "SNBT - snbt - Nakafa",
      description: "Assessment fallback. SNBT",
      keywords: [],
    });
  });

  it("uses article category context for article fallback", () => {
    expect(
      generateFallbackMetadata({
        type: "article",
        category: "politics",
        data: {
          title: "Regional Elections",
          description: "Article fallback.",
        },
      })
    ).toStrictEqual({
      title: "Regional Elections - politics - Nakafa",
      description: "Article fallback. Regional Elections",
      keywords: [],
    });
  });

  it("uses curriculum program context when a title is unavailable", () => {
    expect(
      generateFallbackMetadata({
        type: "curriculum-context",
        level: "track",
        program: "Kurikulum Merdeka",
        data: {
          description: "Curriculum fallback.",
        },
      })
    ).toStrictEqual({
      title: "Kurikulum Merdeka - Nakafa",
      description: "Curriculum fallback.",
      keywords: [],
    });
  });

  it("uses curriculum program context with the content title", () => {
    expect(
      generateFallbackMetadata({
        type: "curriculum-context",
        level: "subject",
        program: "Kurikulum Merdeka",
        data: {
          title: "Biologi",
        },
      })
    ).toStrictEqual({
      title: "Biologi - Kurikulum Merdeka - Nakafa",
      description: "Biologi",
      keywords: [],
    });
  });

  it("uses curriculum parent context when program context is unavailable", () => {
    expect(
      generateFallbackMetadata({
        type: "curriculum-context",
        level: "class",
        parent: "Kurikulum Merdeka",
        data: {
          title: "Kelas 10",
        },
      })
    ).toStrictEqual({
      title: "Kelas 10 - Kurikulum Merdeka - Nakafa",
      description: "Kelas 10",
      keywords: [],
    });
  });

  it("falls back to the site title when curriculum context is empty", () => {
    expect(
      generateFallbackMetadata({
        type: "curriculum-context",
        level: "track",
        data: {},
      })
    ).toStrictEqual({
      title: "Nakafa",
      description: "",
      keywords: [],
    });
  });

  it("uses English Quran translation for Quran fallback", () => {
    expect(
      generateFallbackMetadata({
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
          verses: [],
        },
      })
    ).toStrictEqual({
      title: "The Opening - Nakafa",
      description: "The Opening",
      keywords: [],
    });
  });
});
