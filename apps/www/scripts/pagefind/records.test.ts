// @vitest-environment node
import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import { Effect } from "effect";
import type { PagefindIndex } from "pagefind";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPagefindMaterialCache,
  getExerciseMaterialRootPath,
  getExerciseSetFallbackTitle,
} from "@/scripts/pagefind/material-cache";
import {
  addArticleRecords,
  addExerciseRecords,
  addQuranRecords,
  addSubjectRecords,
} from "@/scripts/pagefind/records";

const mocks = vi.hoisted(() => ({
  addCustomRecord: vi.fn(),
  addHTMLFile: vi.fn(),
  getContentIndexManifest: vi.fn(),
  getContent: vi.fn(),
  getAllSurah: vi.fn(),
  getExercisesContent: vi.fn(),
  getMaterials: vi.fn(),
  getSurah: vi.fn(),
  getSurahName: vi.fn(),
}));

vi.mock("@repo/contents/_lib/content", () => ({
  getContent: mocks.getContent,
}));

vi.mock("@repo/contents/_lib/manifest/cache/route-params", () => ({
  getContentIndexManifest: mocks.getContentIndexManifest,
}));

vi.mock("@repo/contents/_lib/exercises/set", () => ({
  getExercisesContent: mocks.getExercisesContent,
}));

vi.mock("@repo/contents/_lib/exercises/material", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@repo/contents/_lib/exercises/material")
    >();

  return {
    ...actual,
    getMaterials: mocks.getMaterials,
  };
});

vi.mock("@repo/contents/_lib/quran", () => ({
  getAllSurah: mocks.getAllSurah,
  getSurah: mocks.getSurah,
  getSurahName: mocks.getSurahName,
}));

beforeEach(() => {
  clearPagefindMaterialCache();
  vi.clearAllMocks();
  mocks.addCustomRecord.mockResolvedValue({ errors: [] });
  mocks.addHTMLFile.mockResolvedValue({ errors: [] });
  mocks.getExercisesContent.mockReturnValue(Effect.succeed([exercise]));
  mocks.getAllSurah.mockReturnValue([surahListItem]);
  mocks.getSurah.mockReturnValue(Effect.succeed(surah));
  mocks.getSurahName.mockImplementation(({ locale }) => `Surah ${locale}`);
});

describe("Pagefind exercise records", () => {
  it("deduplicates repeated material lookups through native Effect Cache", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedExerciseSetEntries: [
        {
          locale: "en",
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
        },
        {
          locale: "en",
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
        },
      ],
    });
    mocks.getMaterials.mockReturnValue(Effect.succeed(materials));

    const index = {
      addCustomRecord: mocks.addCustomRecord,
    } satisfies Pick<PagefindIndex, "addCustomRecord">;

    const result = await addExerciseRecords(index);

    expect(result.count).toBe(2);
    expect(result.words).toBeGreaterThan(0);
    expect(mocks.getMaterials).toHaveBeenCalledOnce();
    expect(mocks.getMaterials).toHaveBeenCalledWith(
      "/exercises/high-school/snbt/quantitative-knowledge",
      "en"
    );
    expect(mocks.addCustomRecord).toHaveBeenCalledTimes(2);
    expect(mocks.addCustomRecord).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        meta: { title: "Set 1" },
      })
    );
    expect(mocks.addCustomRecord).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        meta: { title: "Set 2" },
      })
    );
  });

  it("uses material group title when the set route matches the group", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedExerciseSetEntries: [
        {
          locale: "en",
          slug: "exercises/high-school/snbt/quantitative-knowledge",
        },
      ],
    });
    mocks.getMaterials.mockReturnValue(Effect.succeed(materials));

    const index = {
      addCustomRecord: mocks.addCustomRecord,
    } satisfies Pick<PagefindIndex, "addCustomRecord">;

    const result = await addExerciseRecords(index);

    expect(result.count).toBe(1);
    expect(mocks.addCustomRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { title: "Quantitative Knowledge" },
      })
    );
  });

  it("uses the set path fallback title when material metadata is absent", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedExerciseSetEntries: [
        {
          locale: "en",
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-3",
        },
      ],
    });
    mocks.getMaterials.mockReturnValue(Effect.succeed([]));

    const index = {
      addCustomRecord: mocks.addCustomRecord,
    } satisfies Pick<PagefindIndex, "addCustomRecord">;

    const result = await addExerciseRecords(index);

    expect(result.count).toBe(1);
    expect(mocks.addCustomRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { title: "set-3" },
      })
    );
  });

  it("skips entries that have no exercises or no possible title", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedExerciseSetEntries: [
        {
          locale: "en",
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-4",
        },
        { locale: "en", slug: "" },
      ],
    });
    mocks.getExercisesContent
      .mockReturnValueOnce(Effect.succeed([]))
      .mockReturnValueOnce(Effect.succeed([exercise]));
    mocks.getMaterials.mockReturnValue(Effect.succeed([]));

    const index = {
      addCustomRecord: mocks.addCustomRecord,
    } satisfies Pick<PagefindIndex, "addCustomRecord">;

    const result = await addExerciseRecords(index);

    expect(result).toEqual({ count: 0, words: 0 });
    expect(mocks.addCustomRecord).not.toHaveBeenCalled();
  });

  it("derives material paths and fallback titles from set paths", () => {
    expect(
      getExerciseMaterialRootPath(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
      )
    ).toBe("/exercises/high-school/snbt/quantitative-knowledge");
    expect(
      getExerciseSetFallbackTitle(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
      )
    ).toBe("set-1");
    expect(getExerciseSetFallbackTitle("")).toBe("");
  });
});

describe("Pagefind source records", () => {
  it("adds article HTML records with escaped metadata and source words", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedArticleEntries: [
        {
          locale: "en",
          slug: "articles/politics/example",
        },
      ],
    });
    mocks.getContent.mockReturnValue(
      Effect.succeed({
        metadata: {
          title: "Article & Title",
          description: "Description <safe>",
        },
        raw: "Visible **article** body",
      })
    );

    const index = {
      addHTMLFile: mocks.addHTMLFile,
    } satisfies Pick<PagefindIndex, "addHTMLFile">;

    const result = await addArticleRecords(index);

    expect(result.count).toBe(1);
    expect(result.words).toBeGreaterThan(0);
    expect(mocks.addHTMLFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/en/articles/politics/example",
        content: expect.stringContaining("Article &amp; Title"),
      })
    );
    expect(mocks.addHTMLFile).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Description &lt;safe&gt;"),
      })
    );
  });

  it("adds subject HTML records with subject fallback descriptions", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedSubjectEntries: [
        {
          locale: "en",
          slug: "subject/high-school/10/math/algebra",
        },
      ],
    });
    mocks.getContent.mockReturnValue(
      Effect.succeed({
        metadata: {
          title: "Algebra",
          subject: "Mathematics",
        },
        raw: "Subject body",
      })
    );

    const index = {
      addHTMLFile: mocks.addHTMLFile,
    } satisfies Pick<PagefindIndex, "addHTMLFile">;

    const result = await addSubjectRecords(index);

    expect(result.count).toBe(1);
    expect(mocks.addHTMLFile).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Mathematics"),
      })
    );
  });

  it("adds subject HTML records when subject metadata is absent", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedSubjectEntries: [
        {
          locale: "en",
          slug: "subject/high-school/10/math/no-subject",
        },
      ],
    });
    mocks.getContent.mockReturnValue(
      Effect.succeed({
        metadata: {
          title: "No Subject",
          description: "Explicit description",
        },
        raw: "Subject body",
      })
    );

    const index = {
      addHTMLFile: mocks.addHTMLFile,
    } satisfies Pick<PagefindIndex, "addHTMLFile">;

    const result = await addSubjectRecords(index);

    expect(result.count).toBe(1);
    expect(mocks.addHTMLFile).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Explicit description"),
      })
    );
  });

  it("adds Quran records and falls back to English translations", async () => {
    const index = {
      addCustomRecord: mocks.addCustomRecord,
    } satisfies Pick<PagefindIndex, "addCustomRecord">;

    const result = await addQuranRecords(index);

    expect(result.count).toBe(2);
    expect(mocks.addCustomRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "id",
        content: expect.stringContaining("English translation"),
      })
    );
  });

  it("surfaces Pagefind custom-record errors", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedExerciseSetEntries: [
        {
          locale: "en",
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
        },
      ],
    });
    mocks.getMaterials.mockReturnValue(Effect.succeed(materials));
    mocks.addCustomRecord.mockResolvedValue({ errors: ["custom failed"] });

    const index = {
      addCustomRecord: mocks.addCustomRecord,
    } satisfies Pick<PagefindIndex, "addCustomRecord">;

    await expect(addExerciseRecords(index)).rejects.toThrow("custom failed");
  });

  it("surfaces Pagefind HTML-file errors", async () => {
    mocks.getContentIndexManifest.mockReturnValue({
      indexedArticleEntries: [
        {
          locale: "en",
          slug: "articles/politics/example",
        },
      ],
    });
    mocks.getContent.mockReturnValue(
      Effect.succeed({
        metadata: {
          title: "Article",
        },
        raw: "Body",
      })
    );
    mocks.addHTMLFile.mockResolvedValue({ errors: ["html failed"] });

    const index = {
      addHTMLFile: mocks.addHTMLFile,
    } satisfies Pick<PagefindIndex, "addHTMLFile">;

    await expect(addArticleRecords(index)).rejects.toThrow("html failed");
  });
});

const exercise = {
  number: 1,
  choices: [],
  question: {
    metadata: { title: "Question title" },
    raw: "Question body",
  },
  answer: {
    metadata: { title: "Answer title" },
    raw: "Answer body",
  },
};

const materials: ExercisesMaterialList = [
  {
    title: "Quantitative Knowledge",
    href: "/exercises/high-school/snbt/quantitative-knowledge",
    items: [
      {
        title: "Set 1",
        href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
      },
      {
        title: "Set 2",
        href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
      },
    ],
  },
];

const surahListItem = {
  name: {
    long: "",
    short: "",
    translation: { en: "", id: "" },
    transliteration: { en: "", id: "" },
  },
  number: 1,
  numberOfVerses: 1,
  revelation: { arab: "", en: "", id: "" },
  sequence: 1,
};

const surah = {
  number: 1,
  name: {
    long: "Long",
    short: "Short",
    translation: { en: "English translation" },
    transliteration: { en: "Transliteration" },
  },
  verses: [
    {
      number: {
        inQuran: 1,
        inSurah: 1,
      },
      juz: 1,
      manzil: 1,
      page: 1,
      ruku: 1,
      hizbQuarter: 1,
      sajda: false,
      text: {
        arab: "Arab",
        transliteration: { en: "Verse" },
      },
      translation: { en: "English translation" },
    },
  ],
};
