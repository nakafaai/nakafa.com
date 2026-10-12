import { describe, expect, it } from "@effect/vitest";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";
import { isLesson, topicsOf } from "@repo/backend/confect/nina/memory/topics";
import { Array as Arr, Effect } from "effect";

const IDENTITY =
  "material:lesson:mathematics:material-section:mathematics:function-composition-inverse-function:function-concept";
const SLUG = "materi/matematika/fungsi-komposisi/konsep-fungsi";

/** The page a learner has open, with the asset id its context holds, if any. */
const page = Effect.fn("test.memory.topics.page")(function* (
  assetId?: string,
  slug = SLUG
) {
  const { context } = yield* openNinaLearningSession({
    capturedAt: "2026-10-10T00:00:00.000Z",
    learning: {
      ...(assetId === undefined ? {} : { assetId }),
      locale: "en",
      slug,
      url: `https://nakafa.com/en/${slug}`,
      verified: true,
    },
    source: "current-page",
  });
  return {
    locale: "en",
    needsFetch: false,
    nina: context,
    slug,
    url: `https://nakafa.com/en/${slug}`,
    verified: true,
  } satisfies NinaPage;
});

/** The topics of a page that name a lesson: the one it shows, or none. */
function lessonTopics(target: NinaPage | undefined) {
  return Arr.filter(topicsOf(target), isLesson);
}

describe("memory lesson", () => {
  it.effect.each(["en", "id", "de"])(
    "names a lesson the same in the %s page",
    (locale) =>
      Effect.gen(function* () {
        expect(
          lessonTopics(yield* page(`asset:${locale}:${IDENTITY}`))
        ).toEqual([`lesson:${IDENTITY}`]);
      })
  );

  it.effect("names no lesson for a page without one", () =>
    Effect.gen(function* () {
      expect(lessonTopics(undefined)).toEqual([]);
      expect(lessonTopics(yield* page())).toEqual([]);
    })
  );

  it.effect.each([
    "home",
    "asset:xx:material:lesson:mathematics",
    "asset:en:video:lesson:mathematics",
    "asset:en:material",
  ])("names no lesson for the asset id %j", (assetId) =>
    Effect.gen(function* () {
      expect(lessonTopics(yield* page(assetId))).toEqual([]);
    })
  );
});

describe("memory topics of a page", () => {
  it.effect(
    "are the lesson first, then the paths above the page, the deepest first",
    () =>
      Effect.gen(function* () {
        expect(topicsOf(yield* page(`asset:en:${IDENTITY}`))).toEqual([
          `lesson:${IDENTITY}`,
          "path:materi/matematika/fungsi-komposisi",
          "path:materi/matematika",
        ]);
      })
  );

  it.effect("are the paths alone for a page that shows no lesson", () =>
    Effect.gen(function* () {
      expect(
        topicsOf(yield* page(undefined, "try-out/indonesia/snbt/2027/set-1"))
      ).toEqual([
        "path:try-out/indonesia/snbt/2027",
        "path:try-out/indonesia/snbt",
        "path:try-out/indonesia",
      ]);
    })
  );

  it.effect("leave out the surface, which every page of it shares", () =>
    Effect.gen(function* () {
      expect(topicsOf(yield* page(undefined, "materi/matematika"))).toEqual([]);
      expect(topicsOf(yield* page(undefined, "materi"))).toEqual([]);
      expect(topicsOf(yield* page(undefined, "home"))).toEqual([]);
      expect(topicsOf(yield* page(undefined, ""))).toEqual([]);
    })
  );

  it.effect("leave out an empty segment of a slug", () =>
    Effect.gen(function* () {
      expect(topicsOf(yield* page(undefined, "/a//b/c/d/"))).toEqual([
        "path:a/b/c",
        "path:a/b",
      ]);
    })
  );

  it("are none without a page", () => {
    expect(topicsOf(undefined)).toEqual([]);
  });

  it.effect("keep the lesson and the seven deepest paths of a deep slug", () =>
    Effect.gen(function* () {
      const segments = Arr.makeBy(12, (index) => `s${index}`);
      const topics = topicsOf(
        yield* page(`asset:en:${IDENTITY}`, Arr.join(segments, "/"))
      );
      expect(topics).toHaveLength(8);
      expect(topics[0]).toBe(`lesson:${IDENTITY}`);
      expect(topics[1]).toBe(`path:${Arr.join(Arr.take(segments, 11), "/")}`);
      expect(topics[7]).toBe(`path:${Arr.join(Arr.take(segments, 5), "/")}`);
    })
  );

  it.effect("leave out a topic of 257 characters, though not one of 256", () =>
    Effect.gen(function* () {
      // The tag `path:` takes five of the characters.
      const fits = `a/${"b".repeat(249)}`;
      const long = `a/${"b".repeat(250)}`;
      expect(topicsOf(yield* page(undefined, `${fits}/page`))).toEqual([
        `path:${fits}`,
      ]);
      expect(topicsOf(yield* page(undefined, `${long}/page`))).toEqual([]);
    })
  );

  it("tell a lesson from a path", () => {
    expect(isLesson(`lesson:${IDENTITY}`)).toBe(true);
    expect(isLesson("path:materi/matematika")).toBe(false);
  });
});
