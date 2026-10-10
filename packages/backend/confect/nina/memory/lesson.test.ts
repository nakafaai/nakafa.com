import { describe, expect, it } from "@effect/vitest";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";
import { lessonOf } from "@repo/backend/confect/nina/memory/lesson";
import { Effect } from "effect";

const IDENTITY =
  "material:lesson:mathematics:material-section:mathematics:function-composition-inverse-function:function-concept";

/** The page a learner has open, with the asset id its context holds, if any. */
const page = Effect.fn("test.memory.lesson.page")(function* (assetId?: string) {
  const { context } = yield* openNinaLearningSession({
    capturedAt: "2026-10-10T00:00:00.000Z",
    learning: {
      ...(assetId === undefined ? {} : { assetId }),
      locale: "en",
      slug: "subject/high-school/limits",
      url: "https://nakafa.com/en/subject/high-school/limits",
      verified: true,
    },
    source: "current-page",
  });
  return {
    locale: "en",
    needsFetch: false,
    nina: context,
    slug: "subject/high-school/limits",
    url: "https://nakafa.com/en/subject/high-school/limits",
    verified: true,
  } satisfies NinaPage;
});

describe("memory lesson", () => {
  it.effect.each(["en", "id", "de"])(
    "names a lesson the same in the %s page",
    (locale) =>
      Effect.gen(function* () {
        expect(lessonOf(yield* page(`asset:${locale}:${IDENTITY}`))).toBe(
          IDENTITY
        );
      })
  );

  it.effect("names no lesson for a page without one", () =>
    Effect.gen(function* () {
      expect(lessonOf(undefined)).toBeUndefined();
      expect(lessonOf(yield* page())).toBeUndefined();
    })
  );

  it.effect.each([
    "home",
    "asset:xx:material:lesson:mathematics",
    "asset:en:video:lesson:mathematics",
    "asset:en:material",
  ])("names no lesson for the asset id %j", (assetId) =>
    Effect.gen(function* () {
      expect(lessonOf(yield* page(assetId))).toBeUndefined();
    })
  );
});
