import {
  readMdxMarkdown,
  readNakafaMarkdown,
} from "@repo/backend/client/nakafa/markdown";
import { api } from "@repo/backend/convex/_generated/api";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const LocaleSchema = Schema.Literal("en", "id");
const PageArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  slug: Schema.String,
});
const SurahArgsSchema = Schema.Struct({
  surah: Schema.Number,
});

const convexUrl = "https://example.convex.cloud";
const articleRoute = "articles/politics/example";
const subjectRoute = "subject/high-school/10/mathematics/topic/section";
const exerciseRoute =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("readNakafaMarkdown", () => {
  it("reads markdown for article, subject, exercise, and Quran refs", async () => {
    const article = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, `en/${articleRoute}`)
    );
    const subject = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, `id/${subjectRoute}`)
    );
    const exercise = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, `id/${exerciseRoute}`)
    );
    const quran = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, "id/quran/1")
    );

    expect(Option.getOrUndefined(article)?.description).toBe("Article intro");
    expect(Option.getOrUndefined(subject)?.description).toBe("Mathematics");
    expect(Option.getOrUndefined(exercise)?.text).toContain("### Choices");
    expect(Option.getOrUndefined(quran)?.title).toBe("Al-Fatihah");
  });

  it("returns none for invalid, missing, and unsupported markdown refs", async () => {
    const invalid = await Effect.runPromise(readNakafaMarkdown(convexUrl, ""));
    const missing = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, "en/articles/missing")
    );
    const articleWithoutDescription = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, "en/articles/no-description")
    );
    const subjectWithoutLabel = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, "id/subject/no-subject")
    );
    const unsupported = await Effect.runPromise(
      readMdxMarkdown(
        convexUrl,
        buildNakafaContentRef("en", "quran/1", "quran")
      )
    );

    expect(Option.isNone(invalid)).toBe(true);
    expect(Option.isNone(missing)).toBe(true);
    expect(Option.getOrUndefined(articleWithoutDescription)?.description).toBe(
      ""
    );
    expect(Option.getOrUndefined(subjectWithoutLabel)?.description).toBe("");
    expect(Option.isNone(unsupported)).toBe(true);
  });
});

/** Routes generated Convex query refs to markdown reader fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: unknown
) {
  if (isRuntimeQuery(query, api.contents.queries.runtime.getArticlePage)) {
    return Promise.resolve(readArticlePage(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getSubjectPage)) {
    return Promise.resolve(readSubjectPage(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getExerciseSetPage)) {
    return Promise.resolve(readExerciseSetPage(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getQuranSurahPage)) {
    return Promise.resolve(readQuranSurahPage(args));
  }

  return Promise.reject(new Error("Unhandled markdown query fixture."));
}

/** Compares generated function references by their Convex function name. */
function isRuntimeQuery(
  query: FunctionReference<"query">,
  target: FunctionReference<"query">
) {
  return getFunctionName(query) === getFunctionName(target);
}

/** Builds one article page fixture for markdown rendering. */
function readArticlePage(args: unknown) {
  const input = Schema.decodeUnknownSync(PageArgsSchema)(args);

  if (input.slug.includes("missing")) {
    return null;
  }

  return {
    articleSlug: "example",
    body: "Article body",
    category: "politics",
    contentHash: "article-hash",
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2025-01-01",
      description: input.slug.includes("no-description")
        ? undefined
        : "Article intro",
      title: "Article title",
    },
    references: [],
    slug: input.slug,
    syncedAt: 1,
  };
}

/** Builds one subject page fixture for markdown rendering. */
function readSubjectPage(args: unknown) {
  const input = Schema.decodeUnknownSync(PageArgsSchema)(args);

  return {
    body: "Subject body",
    category: "high-school",
    contentHash: "subject-hash",
    grade: "10",
    material: "mathematics",
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2025-01-01",
      subject: input.slug.includes("no-subject") ? undefined : "Mathematics",
      title: "Subject title",
    },
    section: "Section",
    slug: input.slug,
    syncedAt: 1,
    topic: "Topic",
  };
}

/** Builds one exercise set page fixture for markdown dispatch coverage. */
function readExerciseSetPage(_args: unknown) {
  return {
    category: "high-school",
    description: "Exercise description",
    exerciseType: "try-out",
    exercises: [
      {
        answer: {
          metadata: { authors: [], date: "2025-01-01", title: "Answer" },
          raw: "Answer raw",
        },
        choices: {
          en: [{ label: "A. Correct", value: true }],
          id: [{ label: "A. Benar", value: true }],
        },
        contentHash: "question-hash",
        number: 1,
        question: {
          metadata: { authors: [], date: "2025-01-01", title: "Question" },
          raw: "Question raw",
        },
      },
    ],
    material: "quantitative-knowledge",
    questionCount: 1,
    setName: "set-1",
    slug: exerciseRoute,
    syncedAt: 1,
    title: "Exercise Set",
    type: "snbt",
    year: "2026",
  };
}

/** Builds one Quran surah page fixture for markdown dispatch coverage. */
function readQuranSurahPage(args: unknown) {
  const input = Schema.decodeUnknownSync(SurahArgsSchema)(args);

  if (input.surah !== 1) {
    return null;
  }

  return {
    nextSurah: null,
    prevSurah: null,
    surahData: {
      name: {
        long: "سورة الفاتحة",
        short: "الفاتحة",
        transliteration: { en: "Al-Faatiha", id: "Al-Fatihah" },
        translation: { en: "The Opening", id: "Pembukaan" },
      },
      number: 1,
      numberOfVerses: 1,
      preBismillah: null,
      revelation: { arab: "مكة", en: "Mecca", id: "Makkah" },
      sequence: 1,
      verses: [
        {
          audio: { primary: "https://audio.example/1.mp3", secondary: [] },
          meta: {
            hizbQuarter: 1,
            juz: 1,
            manzil: 1,
            page: 1,
            ruku: 1,
            sajda: { obligatory: false, recommended: false },
          },
          number: { inQuran: 1, inSurah: 1 },
          tafsir: { id: { long: "Long tafsir", short: "Short tafsir" } },
          text: {
            arab: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
            transliteration: { en: "Bismillahirrahmanirrahim" },
          },
          translation: {
            en: "In the name of Allah.",
            id: "Dengan nama Allah.",
          },
        },
      ],
    },
  };
}
