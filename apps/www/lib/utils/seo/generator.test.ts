// @vitest-environment node
import type { Surah } from "@repo/contents/_types/quran";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";

const { mockCacheLife, mockGetTranslations } = vi.hoisted(() => ({
  mockCacheLife: vi.fn(),
  mockGetTranslations: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: mockCacheLife,
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

type TranslationEntry =
  | string
  | ((values: Record<string, number | string>) => string);

/** Reads one ICU-like mock value as display text. */
function getValue(values: Record<string, number | string>, key: string) {
  return String(values[key] ?? "");
}

const translations = {
  Articles: {
    politics: "Politics",
  },
  Exercises: {
    "quantitative-knowledge": "Quantitative Knowledge",
    snbt: "SNBT",
  },
  Metadata: {
    title: "Nakafa",
  },
  SEO: {
    "article.description": (values) =>
      `Generated article description for ${getValue(values, "title")}.`,
    "article.keywords": (values) =>
      `${getValue(values, "title")}, ${getValue(values, "category")}, article`,
    "article.title": (values) =>
      `${getValue(values, "title")} - ${getValue(values, "category")} | Nakafa`,
    "exercise.description": (values) =>
      `Take ${getValue(values, "material")} ${getValue(values, "exam")} exercise with ${getValue(values, "questionCount")} questions and explanations for checking your reasoning.`,
    "exercise.keywords": (values) =>
      `${getValue(values, "material")}, ${getValue(values, "exam")}, exercise`,
    "exercise.title": (values) =>
      `Question ${getValue(values, "number")}/${getValue(values, "questionCount")}: ${getValue(values, "material")} (${getValue(values, "exam")}) | Nakafa`,
    "quran.description": (values) =>
      `Read Surah ${getValue(values, "name")} with ${getValue(values, "numberOfVerses")} verses.`,
    "quran.keywords": (values) =>
      `${getValue(values, "name")}, ${getValue(values, "translation")}, ${getValue(values, "revelation")}`,
    "quran.title": (values) =>
      `Surah ${getValue(values, "number")}. ${getValue(values, "name")} - ${getValue(values, "translation")} | Nakafa`,
    "subject.description": (values) =>
      `Generated subject description for ${getValue(values, "title")} in ${getValue(values, "material")} for ${getValue(values, "grade")}.`,
    "subject.keywords": (values) =>
      `${getValue(values, "title")}, ${getValue(values, "material")}, ${getValue(values, "grade")}`,
    /** Formats subject titles with the same chapter-aware shape as the locale dictionary. */
    "subject.title": (values) => {
      const chapter = getValue(values, "chapter");
      const chapterPrefix = chapter === "__EMPTY__" ? "" : `${chapter} - `;

      return `${getValue(values, "title")}: ${chapterPrefix}${getValue(values, "material")} (${getValue(values, "grade")}) | Nakafa`;
    },
  },
  Subject: {
    "ai-ds": "Artificial Intelligence & Data Science",
    bachelor: "Bachelor",
    grade: (values) => `Grade ${getValue(values, "grade")}`,
    mathematics: "Mathematics",
  },
} satisfies Record<string, Record<string, TranslationEntry>>;

const translationMap: Record<
  string,
  Record<string, TranslationEntry>
> = translations;

/** Returns the mocked translator for the requested namespace. */
function getTranslator(namespace: string) {
  const dictionary = translationMap[namespace] ?? {};

  return (key: string, values: Record<string, number | string> = {}) => {
    const entry = dictionary[key];

    if (typeof entry === "function") {
      return entry(values);
    }

    return entry ?? key;
  };
}

const surah = {
  name: {
    long: "الفاتحة",
    short: "Al-Fatihah",
    translation: {
      en: "The Opening",
      id: "Pembukaan",
    },
    transliteration: {
      en: "Al-Fatihah",
      id: "Al-Fatihah",
    },
  },
  number: 1,
  numberOfVerses: 7,
  preBismillah: null,
  revelation: {
    arab: "مكة",
    en: "Meccan",
    id: "Makkiyah",
  },
  sequence: 5,
  verses: [],
} satisfies Surah;

beforeEach(() => {
  mockCacheLife.mockClear();
  mockGetTranslations.mockReset();
  mockGetTranslations.mockImplementation(({ namespace }) =>
    Promise.resolve(getTranslator(namespace))
  );
});

describe("generateSEOMetadata", () => {
  it("uses subject MDX description before generated fallback copy", async () => {
    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {
          title: "Trigonometric Function Graph",
          description: "Hand-written subject summary for students.",
        },
      },
      "en"
    );

    expect(result.description).toBe(
      "Hand-written subject summary for students."
    );
    expect(result.title).toBe(
      "Trigonometric Function Graph: Mathematics (Grade 11) | Nakafa"
    );
    expect(result.keywords).toEqual([
      "Trigonometric Function Graph",
      "Mathematics",
      "Grade 11",
    ]);
  });

  it("uses generated subject description when MDX description is missing", async () => {
    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "university",
        grade: "bachelor",
        material: "mathematics",
        data: {
          title: "Linear Algebra",
          description: "   ",
        },
      },
      "en"
    );

    expect(result.description).toBe(
      "Generated subject description for Linear Algebra in Mathematics for Bachelor."
    );
  });

  it("uses subject metadata when title is missing", async () => {
    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {
          title: "   ",
          subject: "Function Modeling",
        },
      },
      "en"
    );

    expect(result.title).toBe(
      "Function Modeling: Mathematics (Grade 11) | Nakafa"
    );
  });

  it("uses the site title when content title and subject are missing", async () => {
    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {},
      },
      "en"
    );

    expect(result.title).toBe("Nakafa: Mathematics (Grade 11) | Nakafa");
  });

  it("keeps long subject titles intact in the localized title template", async () => {
    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "university",
        grade: "bachelor",
        material: "ai-ds",
        chapter: "Linear Methods of AI",
        data: {
          title: "Best Approximation in Function and Polynomial Spaces",
        },
      },
      "en"
    );

    expect(result.title).toBe(
      "Best Approximation in Function and Polynomial Spaces: Linear Methods of AI - Artificial Intelligence & Data Science (Bachelor) | Nakafa"
    );
  });

  it("uses article MDX description before generated fallback copy", async () => {
    const result = await generateSEOMetadata(
      {
        type: "article",
        category: "politics",
        data: {
          title: "Regional Elections",
          description: "Hand-written article summary.",
        },
      },
      "en"
    );

    expect(result.description).toBe("Hand-written article summary.");
    expect(result.title).toBe("Regional Elections - Politics | Nakafa");
  });

  it("keeps long article titles intact in the localized title template", async () => {
    const result = await generateSEOMetadata(
      {
        type: "article",
        category: "politics",
        data: {
          title:
            "Nepotism: The Machinations of Power in the Political Chessboard of Governance",
        },
      },
      "en"
    );

    expect(result.title).toBe(
      "Nepotism: The Machinations of Power in the Political Chessboard of Governance - Politics | Nakafa"
    );
  });

  it("uses generated article description when MDX description is missing", async () => {
    const result = await generateSEOMetadata(
      {
        type: "article",
        category: "politics",
        data: {
          title: "Regional Elections",
        },
      },
      "en"
    );

    expect(result.description).toBe(
      "Generated article description for Regional Elections."
    );
  });

  it("keeps exercise metadata tied to exam, material, and question count", async () => {
    const result = await generateSEOMetadata(
      {
        type: "exercise",
        category: "high-school",
        exam: "snbt",
        material: "quantitative-knowledge",
        number: 9,
        questionCount: 20,
        data: {
          title: "Question 9",
        },
      },
      "en"
    );

    expect(result.title).toBe(
      "Question 9/20: Quantitative Knowledge (SNBT) | Nakafa"
    );
    expect(result.description).toBe(
      "Take Quantitative Knowledge SNBT exercise with 20 questions and explanations for checking your reasoning."
    );
  });

  it("uses exercise defaults when optional route data is absent", async () => {
    const result = await generateSEOMetadata(
      {
        type: "exercise",
        category: "high-school",
        exam: "snbt",
        material: "quantitative-knowledge",
        group: "Try Out",
        set: "Set 1",
        data: {
          title: "Practice Set",
        },
      },
      "en"
    );

    expect(result.title).toBe(
      "Question 0/0: Quantitative Knowledge (SNBT) | Nakafa"
    );
    expect(result.description).toBe(
      "Take Quantitative Knowledge SNBT exercise with 0 questions and explanations for checking your reasoning."
    );
  });

  it("generates Quran metadata from the surah payload", async () => {
    const result = await generateSEOMetadata(
      {
        type: "quran",
        surah,
      },
      "en"
    );

    expect(result.title).toBe("Surah 1. Al-Fatihah - The Opening | Nakafa");
    expect(result.description).toBe("Read Surah Al-Fatihah with 7 verses.");
  });

  it("falls back to English Quran labels when locale labels are empty", async () => {
    const result = await generateSEOMetadata(
      {
        type: "quran",
        surah: {
          ...surah,
          name: {
            ...surah.name,
            translation: {
              en: "The Opening",
              id: "",
            },
            transliteration: {
              en: "Al-Fatihah",
              id: "",
            },
          },
          revelation: {
            arab: "مكة",
            en: "Meccan",
            id: "",
          },
        },
      },
      "id"
    );

    expect(result.title).toBe("Surah 1. Al-Fatihah - The Opening | Nakafa");
    expect(result.keywords).toEqual(["Al-Fatihah", "The Opening", "Meccan"]);
  });

  it("falls back to the short Quran name when translated names are empty", async () => {
    const result = await generateSEOMetadata(
      {
        type: "quran",
        surah: {
          ...surah,
          name: {
            ...surah.name,
            translation: {
              en: "",
              id: "",
            },
            transliteration: {
              en: "",
              id: "",
            },
          },
          revelation: {
            arab: "مكة",
            en: "",
            id: "",
          },
        },
      },
      "id"
    );

    expect(result.title).toBe("Surah 1. Al-Fatihah - Al-Fatihah | Nakafa");
    expect(result.keywords).toEqual(["Al-Fatihah", "Al-Fatihah", ""]);
  });

  it("keeps Quran metadata stable when all display names are empty", async () => {
    const result = await generateSEOMetadata(
      {
        type: "quran",
        surah: {
          ...surah,
          name: {
            ...surah.name,
            short: "",
            translation: {
              en: "",
              id: "",
            },
          },
        },
      },
      "id"
    );

    expect(result.title).toBe("Surah 1.  -  | Nakafa");
  });

  it("falls back to legacy metadata builders when translations fail", async () => {
    mockGetTranslations.mockRejectedValueOnce("missing translations");

    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {
          title: "Trigonometric Function Graph",
          description: "Graph lesson fallback.",
        },
      },
      "en"
    );

    expect(result).toStrictEqual({
      title: "Trigonometric Function Graph - mathematics - Nakafa",
      description: "Graph lesson fallback. Trigonometric Function Graph",
      keywords: [],
    });
  });

  it("falls back when Metadata translations fail for the ultimate title fallback", async () => {
    mockGetTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Metadata") {
        return Promise.reject(new Error("missing Metadata translations"));
      }

      return Promise.resolve(getTranslator(namespace));
    });

    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {},
      },
      "en"
    );

    expect(result).toStrictEqual({
      title: "mathematics - Nakafa",
      description: "",
      keywords: [],
    });
  });

  it("falls back when Subject translations fail", async () => {
    mockGetTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Subject") {
        return Promise.reject(new Error("missing Subject translations"));
      }

      return Promise.resolve(getTranslator(namespace));
    });

    const result = await generateSEOMetadata(
      {
        type: "subject",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {
          title: "Trigonometric Function Graph",
          description: "Graph lesson fallback.",
        },
      },
      "en"
    );

    expect(result).toStrictEqual({
      title: "Trigonometric Function Graph - mathematics - Nakafa",
      description: "Graph lesson fallback. Trigonometric Function Graph",
      keywords: [],
    });
  });

  it("falls back to Quran metadata when Quran translations fail", async () => {
    mockGetTranslations.mockRejectedValueOnce(
      new Error("missing translations")
    );

    const result = await generateSEOMetadata(
      {
        type: "quran",
        surah,
      },
      "en"
    );

    expect(result).toStrictEqual({
      title: "The Opening - Nakafa",
      description: "The Opening",
      keywords: [],
    });
  });

  it("falls back to exercise metadata when exercise translations fail", async () => {
    mockGetTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Exercises") {
        return Promise.reject(new Error("missing Exercises translations"));
      }

      return Promise.resolve(getTranslator(namespace));
    });

    const result = await generateSEOMetadata(
      {
        type: "exercise",
        category: "high-school",
        exam: "snbt",
        material: "quantitative-knowledge",
        data: {
          title: "Question 9",
          description: "Exercise fallback.",
        },
      },
      "en"
    );

    expect(result).toStrictEqual({
      title: "Question 9 - quantitative-knowledge - Nakafa",
      description: "Exercise fallback. Question 9",
      keywords: [],
    });
  });

  it("falls back to article metadata when article translations fail", async () => {
    mockGetTranslations.mockImplementation(({ namespace }) => {
      if (namespace === "Articles") {
        return Promise.reject(new Error("missing Articles translations"));
      }

      return Promise.resolve(getTranslator(namespace));
    });

    const result = await generateSEOMetadata(
      {
        type: "article",
        category: "politics",
        data: {
          title: "Regional Elections",
          description: "Article fallback.",
        },
      },
      "en"
    );

    expect(result).toStrictEqual({
      title: "Regional Elections - politics - Nakafa",
      description: "Article fallback. Regional Elections",
      keywords: [],
    });
  });
});
