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

interface TranslationValues {
  readonly [key: string]: number | string | undefined;
}
type TranslationEntry = string | ((values: TranslationValues) => string);
interface TranslationDictionary {
  readonly [key: string]: TranslationEntry | undefined;
}
interface TranslationNamespaces {
  readonly [namespace: string]: TranslationDictionary | undefined;
}

/** Reads one ICU-like mock value as display text. */
function getValue(values: TranslationValues, key: string) {
  return String(values[key] ?? "");
}

const translations: TranslationNamespaces = {
  Articles: {
    politics: "Politics",
  },
  Exercises: {
    "high-school": "High School",
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
    "curriculum.description": (values) => {
      const parent = getValue(values, "parent");
      const program = getValue(values, "program");
      const parentText = parent === "__EMPTY__" ? "" : ` in ${parent}`;
      const programText = program === "__EMPTY__" ? "" : ` for ${program}`;

      return `Browse ${getValue(values, "title")}${parentText}${programText}.`;
    },
    "curriculum.keywords": (values) =>
      [
        getValue(values, "title"),
        getValue(values, "parent"),
        getValue(values, "program"),
      ]
        .filter((value) => value && value !== "__EMPTY__")
        .join(", "),
    "curriculum.title": (values) => {
      const parent = getValue(values, "parent");
      const program = getValue(values, "program");
      const parentText = parent === "__EMPTY__" ? "" : ` - ${parent}`;
      const programText = program === "__EMPTY__" ? "" : ` (${program})`;

      return `${getValue(values, "title")}${parentText}${programText} | Nakafa`;
    },
    "exercise-program.description": (values) =>
      `Choose ${getValue(values, "exam")} practice domains for ${getValue(values, "category")}.`,
    "exercise-program.keywords": (values) =>
      `${getValue(values, "exam")}, ${getValue(values, "category")}, practice questions`,
    "exercise-program.title": (values) =>
      `${getValue(values, "exam")} Practice Questions | Nakafa`,
    "exercise.description": (values) => {
      const count = getValue(values, "questionCount");
      const countLabel =
        count === "0" ? "practice questions" : `${count} questions`;

      return `Take ${getValue(values, "material")} ${getValue(values, "exam")} exercise with ${countLabel} and explanations for checking your reasoning.`;
    },
    "exercise.keywords": (values) =>
      `${getValue(values, "material")}, ${getValue(values, "exam")}, exercise`,
    "exercise.title": (values) => {
      const number = getValue(values, "number");
      const questionTotal = getValue(values, "questionTotal");
      const total = questionTotal === "__EMPTY__" ? "" : questionTotal;
      const questionPrefix =
        number === "0" ? "" : `Question ${number}${total}: `;
      const set = getValue(values, "set");
      const setPrefix =
        set === "__EMPTY__" ? "" : `${set}${number === "0" ? ": " : " - "}`;
      const group = getValue(values, "group");
      const groupPrefix = group === "__EMPTY__" ? "" : `${group} - `;

      return `${questionPrefix}${setPrefix}${groupPrefix}${getValue(values, "material")} (${getValue(values, "exam")}) | Nakafa`;
    },
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
};

/** Returns the mocked translator for the requested namespace. */
function getTranslator(namespace: string) {
  const dictionary = translations[namespace] ?? {};

  return (key: string, values: TranslationValues = {}) => {
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
        type: "material-lesson",
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
        type: "material-lesson",
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
        type: "material-lesson",
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
        type: "material-lesson",
        category: "high-school",
        grade: "11",
        material: "mathematics",
        data: {},
      },
      "en"
    );

    expect(result.title).toBe("Nakafa: Mathematics (Grade 11) | Nakafa");
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
      "Set 1: Try Out - Quantitative Knowledge (SNBT) | Nakafa"
    );
    expect(result.description).toBe(
      "Take Quantitative Knowledge SNBT exercise with practice questions and explanations for checking your reasoning."
    );
  });

  it("generates assessment-root metadata without borrowing a material title", async () => {
    const result = await generateSEOMetadata(
      {
        type: "exercise-program",
        category: "high-school",
        exam: "snbt",
        data: { title: "SNBT" },
      },
      "en"
    );

    expect(result.title).toBe("SNBT Practice Questions | Nakafa");
    expect(result.description).toBe(
      "Choose SNBT practice domains for High School."
    );
  });

  it("generates curriculum metadata from source-owned route context", async () => {
    const nested = await generateSEOMetadata(
      {
        type: "curriculum-context",
        level: "subject",
        parent: "Grade 11",
        program: "Kurikulum Merdeka",
        data: { title: "Mathematics" },
      },
      "en"
    );
    const root = await generateSEOMetadata(
      {
        type: "curriculum-context",
        level: "track",
        data: { title: "Mathematics" },
      },
      "en"
    );

    expect(nested.title).toBe(
      "Mathematics - Grade 11 (Kurikulum Merdeka) | Nakafa"
    );
    expect(nested.keywords).toEqual([
      "Mathematics",
      "Grade 11",
      "Kurikulum Merdeka",
    ]);
    expect(root.title).toBe("Mathematics | Nakafa");
    expect(root.description).toBe("Browse Mathematics.");
  });

  it("omits the question total when metadata has no runtime count", async () => {
    const result = await generateSEOMetadata(
      {
        type: "exercise",
        category: "high-school",
        exam: "snbt",
        material: "quantitative-knowledge",
        group: "Try Out 2026",
        set: "Set 1",
        number: 9,
        data: { title: "Set 1" },
      },
      "en"
    );

    expect(result.title).toBe(
      "Question 9: Set 1 - Try Out 2026 - Quantitative Knowledge (SNBT) | Nakafa"
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

  it("uses fallback metadata when dictionary loading fails", async () => {
    mockGetTranslations.mockRejectedValueOnce("missing translations");

    const result = await generateSEOMetadata(
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
    );

    expect(result).toStrictEqual({
      title: "Trigonometric Function Graph - mathematics - Nakafa",
      description: "Graph lesson fallback. Trigonometric Function Graph",
      keywords: [],
    });
  });
});
