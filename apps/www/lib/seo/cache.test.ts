// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ContentCacheScope } from "@nakafa/aksara-contracts/cache/content";
import { Effect } from "effect";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import type { SEOContext } from "@/lib/seo/contract";

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));
vi.mock("@/lib/seo/generator", () => ({
  generateSEOMetadata: mocks.generate,
}));

beforeEach(() => {
  mocks.cacheLife.mockReset();
  mocks.cacheTag.mockReset();
  mocks.generate.mockReset();
  mocks.generate.mockReturnValue(
    Effect.succeed({
      description: "Learn functions.",
      keywords: ["functions"],
      title: "Functions",
    })
  );
});

const materialLessonContext: SEOContext = {
  type: "material-lesson",
  data: { title: "Functions" },
  grade: "12",
  material: "mathematics",
};
const curriculumContext: SEOContext = {
  type: "curriculum-context",
  data: {},
  level: "topic",
};
const articleContext: SEOContext = {
  type: "article",
  categoryLabel: "Politics",
  data: {},
};
const quranContext: SEOContext = {
  type: "quran",
  surah: {
    kind: "quran-surah",
    name: {
      arabic: "الفاتحة",
      meaning: {
        de: "Die Eröffnende",
        en: "The Opening",
        id: "Pembuka",
      },
      transliteration: "Al-Fatihah",
    },
    number: 1,
    numberOfVerses: 7,
    revelation: { order: 5, place: "Meccan" },
  },
};
const scopeCases: readonly (readonly [SEOContext, ContentCacheScope])[] = [
  [materialLessonContext, "material"],
  [curriculumContext, "program"],
  [articleContext, "article"],
  [quranContext, "quran"],
];

describe("SEO cache boundary", () => {
  it.effect.each(scopeCases)(
    "tags %s metadata with the family it reads",
    ([context, scope]) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => getCachedSEOMetadata(context, "en"),
          catch: (cause) => String(cause),
        });

        expect(result).toMatchObject({ title: "Functions" });
        expect(mocks.cacheTag).toHaveBeenCalledExactlyOnceWith(
          `content-scope:${scope}`
        );
        expect(mocks.cacheLife).toHaveBeenCalledWith("max");
        expect(mocks.generate).toHaveBeenCalledWith(context, "en");
      })
  );
});
