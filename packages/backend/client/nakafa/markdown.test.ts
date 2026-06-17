import {
  readMdxMarkdown,
  readNakafaMarkdown,
} from "@repo/backend/client/nakafa/markdown";
import { api } from "@repo/backend/convex/_generated/api";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { LocaleSchema } from "@repo/contents/_types/content";
import { findPublicRouteByPath } from "@repo/contents/_types/route/projection";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const PageArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  slug: Schema.String,
});
const RouteArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  route: Schema.String,
});
const ContentIdArgsSchema = Schema.Struct({
  contentId: Schema.String,
});
const SurahArgsSchema = Schema.Struct({
  surah: Schema.Number,
});

const convexUrl = "https://example.convex.cloud";
const articleRoute = "articles/politics/example";
const subjectRoute = "material/lesson/mathematics/topic/section";
const exerciseRoute =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("readNakafaMarkdown", () => {
  it("reads markdown for article, subject, exercise, and Quran refs", async () => {
    const articleRef = readNakafaContentRefFixture(
      "en",
      articleRoute,
      "articles"
    );
    const exerciseRef = readNakafaContentRefFixture(
      "id",
      exerciseRoute,
      "material"
    );
    const article = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, articleRef.content_id)
    );
    const subjectRef = readNakafaContentRefFixture(
      "id",
      subjectRoute,
      "material"
    );
    const subject = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, subjectRef.content_id)
    );
    const exercise = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, exerciseRef.content_id)
    );
    const quran = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, "https://nakafa.com/id/quran/1")
    );

    expect(Option.getOrUndefined(article)?.description).toBe("Article intro");
    expect(Option.getOrUndefined(subject)?.description).toBe("Mathematics");
    expect(Option.getOrUndefined(exercise)?.text).toContain("### Choices");
    expect(Option.getOrUndefined(quran)?.title).toBe("Al-Fatihah");
  });

  it("returns none for invalid, missing, and unsupported markdown refs", async () => {
    const invalid = await Effect.runPromise(readNakafaMarkdown(convexUrl, ""));
    const bareRoute = await Effect.runPromise(
      readNakafaMarkdown(convexUrl, "en/articles/politics/example")
    );
    const missing = await Effect.runPromise(
      readNakafaMarkdown(
        convexUrl,
        "https://nakafa.com/en/articles/politics/missing"
      )
    );
    const articleWithoutDescription = await Effect.runPromise(
      readNakafaMarkdown(
        convexUrl,
        "https://nakafa.com/en/articles/politics/no-description"
      )
    );
    const subjectWithoutLabel = await Effect.runPromise(
      readMdxMarkdown(
        convexUrl,
        readNakafaContentRefFixture(
          "id",
          "material/lesson/mathematics/topic/no-subject",
          "material"
        )
      )
    );
    const unsupported = await Effect.runPromise(
      readMdxMarkdown(
        convexUrl,
        readNakafaContentRefFixture("en", "quran/1", "quran")
      )
    );

    expect(Option.isNone(invalid)).toBe(true);
    expect(Option.isNone(bareRoute)).toBe(true);
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
  if (
    isRuntimeQuery(
      query,
      api.contents.queries.runtime.getContentRouteByContentId
    )
  ) {
    return Promise.resolve(readContentRouteByContentId(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getContentRoute)) {
    return Promise.resolve(readContentRoute(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getArticlePage)) {
    return Promise.resolve(readArticlePage(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getCurriculumPage)) {
    return Promise.resolve(readCurriculumPage(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getExerciseSetPage)) {
    return Promise.resolve(readExerciseSetPage(args));
  }

  if (isRuntimeQuery(query, api.contents.queries.runtime.getQuranSurahPage)) {
    return Promise.resolve(readQuranSurahPage(args));
  }

  return Promise.reject(new Error("Unhandled markdown query fixture."));
}

/** Builds one route lookup fixture from a graph asset ID. */
function readContentRouteByContentId(args: unknown) {
  const input = Schema.decodeUnknownSync(ContentIdArgsSchema)(args);
  const refs = [
    readNakafaContentRefFixture("en", articleRoute, "articles"),
    readNakafaContentRefFixture("id", subjectRoute, "material"),
    readNakafaContentRefFixture("id", exerciseRoute, "material"),
    readNakafaContentRefFixture("id", "quran/1", "quran"),
  ];
  const ref = refs.find((item) => item.content_id === input.contentId);

  if (!ref) {
    return null;
  }

  return {
    ...ref,
    title: ref.route,
  };
}

/** Resolves public route fixtures first, then handles internal source-path samples used by markdown tests. */
function readContentRoute(args: unknown) {
  const input = Schema.decodeUnknownSync(RouteArgsSchema)(args);

  if (input.route.includes("missing")) {
    return null;
  }

  const publicRoute = Effect.runSync(
    findPublicRouteByPath(input.route, input.locale)
  );

  if (Option.isSome(publicRoute)) {
    const route = publicRoute.value;

    if (
      route.kind === "exercise-question" ||
      route.kind === "exercise-set" ||
      route.kind === "subject-lesson" ||
      route.kind === "subject-topic"
    ) {
      return {
        ...readNakafaContentRefFixture(
          input.locale,
          route.sourcePath,
          "material"
        ),
        route: route.publicPath,
        sourcePath: route.sourcePath,
        title: route.title,
      };
    }
  }

  return {
    ...readNakafaContentRefFixture(
      input.locale,
      input.route,
      getSection(input.route)
    ),
    title: input.route,
  };
}

/** Classifies fixture routes into the content section expected by the markdown reader. */
function getSection(route: string) {
  if (route.startsWith("articles/")) {
    return "articles";
  }

  if (route.startsWith("material/")) {
    return "material";
  }

  return "quran";
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

/** Builds one curriculum page fixture for markdown rendering. */
function readCurriculumPage(args: unknown) {
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
