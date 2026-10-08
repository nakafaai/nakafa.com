// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import { Effect, HashMap, Option, Schema } from "effect";
import { generateSEOMetadata } from "@/lib/seo/generator";

const { mockGetTranslations } = vi.hoisted(() => ({
  mockGetTranslations: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

const TranslationValuesSchema = Schema.Record(
  Schema.String,
  Schema.UndefinedOr(Schema.Union([Schema.Finite, Schema.String]))
);
type TranslationValues = typeof TranslationValuesSchema.Type;
type TranslationEntry = string | ((values: TranslationValues) => string);
type TranslationDictionary = HashMap.HashMap<string, TranslationEntry>;
type TranslationNamespaces = HashMap.HashMap<string, TranslationDictionary>;

/** Reads one ICU-like mock value as display text. */
function getValue(values: TranslationValues, key: string) {
  return String(values[key] ?? "");
}

const translations: TranslationNamespaces = HashMap.fromIterable([
  [
    "Articles",
    HashMap.fromIterable<string, TranslationEntry>([["politics", "Politics"]]),
  ],
  [
    "Metadata",
    HashMap.fromIterable<string, TranslationEntry>([["title", "Nakafa"]]),
  ],
  [
    "SEO",
    HashMap.fromIterable<string, TranslationEntry>([
      [
        "article.description",
        (values) =>
          `Generated article description for ${getValue(values, "title")}.`,
      ],
      [
        "article.keywords",
        (values) =>
          `${getValue(values, "title")}, ${getValue(values, "category")}, article`,
      ],
      [
        "article.title",
        (values) =>
          `${getValue(values, "title")} - ${getValue(values, "category")} | Nakafa`,
      ],
      [
        "curriculum.description",
        (values) => {
          const parent = getValue(values, "parent");
          const program = getValue(values, "program");
          const parentText = parent === "__EMPTY__" ? "" : ` in ${parent}`;
          const programText = program === "__EMPTY__" ? "" : ` for ${program}`;

          return `Browse ${getValue(values, "title")}${parentText}${programText}.`;
        },
      ],
      [
        "curriculum.keywords",
        (values) =>
          [
            getValue(values, "title"),
            getValue(values, "parent"),
            getValue(values, "program"),
          ]
            .filter((value) => value && value !== "__EMPTY__")
            .join(", "),
      ],
      [
        "curriculum.title",
        (values) => {
          const parent = getValue(values, "parent");
          const program = getValue(values, "program");
          const parentText = parent === "__EMPTY__" ? "" : ` - ${parent}`;
          const programText = program === "__EMPTY__" ? "" : ` (${program})`;

          return `${getValue(values, "title")}${parentText}${programText} | Nakafa`;
        },
      ],
      [
        "quran.description",
        (values) =>
          `Read Surah ${getValue(values, "name")} with ${getValue(values, "numberOfVerses")} verses.`,
      ],
      [
        "quran.keywords",
        (values) =>
          `${getValue(values, "name")}, ${getValue(values, "translation")}, ${getValue(values, "revelation")}`,
      ],
      [
        "quran.title",
        (values) =>
          `Surah ${getValue(values, "number")}. ${getValue(values, "name")} - ${getValue(values, "translation")} | Nakafa`,
      ],
      [
        "subject.description",
        (values) =>
          `Generated subject description for ${getValue(values, "title")} in ${getValue(values, "material")} for ${getValue(values, "grade")}.`,
      ],
      [
        "subject.keywords",
        (values) =>
          `${getValue(values, "title")}, ${getValue(values, "material")}, ${getValue(values, "grade")}`,
      ],
      /** Formats subject titles with the same chapter-aware shape as the locale dictionary. */
      [
        "subject.title",
        (values) => {
          const chapter = getValue(values, "chapter");
          const chapterPrefix = chapter === "__EMPTY__" ? "" : `${chapter} - `;

          return `${getValue(values, "title")}: ${chapterPrefix}${getValue(values, "material")} (${getValue(values, "grade")}) | Nakafa`;
        },
      ],
    ]),
  ],
  [
    "Subject",
    HashMap.fromIterable<string, TranslationEntry>([
      ["ai-ds", "Artificial Intelligence & Data Science"],
      ["bachelor", "Bachelor"],
      ["grade", (values) => `Grade ${getValue(values, "grade")}`],
      ["mathematics", "Mathematics"],
    ]),
  ],
]);

/** Returns the mocked translator for the requested namespace. */
function getTranslator(namespace: string) {
  const dictionary = Option.getOrElse(
    HashMap.get(translations, namespace),
    () => HashMap.empty<string, TranslationEntry>()
  );

  return (key: string, values: TranslationValues = {}) => {
    const entry = Option.getOrUndefined(HashMap.get(dictionary, key));

    if (typeof entry === "function") {
      return entry(values);
    }

    return entry ?? key;
  };
}

const surah = {
  kind: "quran-surah",
  name: {
    arabic: "Al-Fatihah",
    meaning: { de: "Die Eröffnende", en: "The Opening", id: "Pembuka" },
    transliteration: "Al-Fatihah",
  },
  number: 1,
  numberOfVerses: 7,
  revelation: { order: 5, place: "Meccan" },
} satisfies QuranSurahRow;

beforeEach(() => {
  mockGetTranslations.mockReset();
  mockGetTranslations.mockImplementation(({ namespace }) =>
    Promise.resolve(getTranslator(namespace))
  );
});

describe("generateSEOMetadata", () => {
  it.effect("uses subject MDX description before generated fallback copy", () =>
    Effect.gen(function* () {
      const result = yield* generateSEOMetadata(
        {
          type: "material-lesson",
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
    })
  );

  it.effect(
    "uses generated subject description when MDX description is missing",
    () =>
      Effect.gen(function* () {
        const result = yield* generateSEOMetadata(
          {
            type: "material-lesson",
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
      })
  );

  it.effect("uses subject metadata when title is missing", () =>
    Effect.gen(function* () {
      const result = yield* generateSEOMetadata(
        {
          type: "material-lesson",
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
    })
  );

  it.effect(
    "uses the site title when content title and subject are missing",
    () =>
      Effect.gen(function* () {
        const result = yield* generateSEOMetadata(
          {
            type: "material-lesson",
            grade: "11",
            material: "mathematics",
            data: {},
          },
          "en"
        );

        expect(result.title).toBe("Nakafa: Mathematics (Grade 11) | Nakafa");
      })
  );

  it.effect("uses article MDX description before generated fallback copy", () =>
    Effect.gen(function* () {
      const result = yield* generateSEOMetadata(
        {
          type: "article",
          categoryLabel: "Politics",
          data: {
            title: "Regional Elections",
            description: "Hand-written article summary.",
          },
        },
        "en"
      );

      expect(result.description).toBe("Hand-written article summary.");
      expect(result.title).toBe("Regional Elections - Politics | Nakafa");
    })
  );

  it.effect(
    "uses generated article description when MDX description is missing",
    () =>
      Effect.gen(function* () {
        const result = yield* generateSEOMetadata(
          {
            type: "article",
            categoryLabel: "Politics",
            data: {
              title: "Regional Elections",
            },
          },
          "en"
        );

        expect(result.description).toBe(
          "Generated article description for Regional Elections."
        );
      })
  );

  it.effect(
    "generates curriculum metadata from source-owned route context",
    () =>
      Effect.gen(function* () {
        const nested = yield* generateSEOMetadata(
          {
            type: "curriculum-context",
            level: "subject",
            parent: "Grade 11",
            program: "Kurikulum Merdeka",
            data: { title: "Mathematics" },
          },
          "en"
        );
        const root = yield* generateSEOMetadata(
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
      })
  );

  it.effect("generates Quran metadata from the surah payload", () =>
    Effect.gen(function* () {
      const result = yield* generateSEOMetadata(
        {
          type: "quran",
          surah,
        },
        "en"
      );

      expect(result.title).toBe("Surah 1. Al-Fatihah - The Opening | Nakafa");
      expect(result.description).toBe("Read Surah Al-Fatihah with 7 verses.");
    })
  );

  it.effect("uses fallback metadata when dictionary loading fails", () =>
    Effect.gen(function* () {
      mockGetTranslations.mockRejectedValueOnce("missing translations");

      const result = yield* generateSEOMetadata(
        {
          type: "material-lesson",
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
    })
  );
});
