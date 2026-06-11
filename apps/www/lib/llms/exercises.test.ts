// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedLlmsExerciseText } from "@/lib/llms/exercises";

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockCacheTag = vi.hoisted(() => vi.fn());
const mockGetRuntimeExerciseSetPage = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  cacheLife: mockCacheLife,
  cacheTag: mockCacheTag,
}));

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeExerciseSetPage: mockGetRuntimeExerciseSetPage,
}));

const validSetPath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

const exerciseWithLocalizedChoices = {
  answer: {
    raw: "Answer raw",
  },
  choices: {
    en: [
      { label: "A. Correct", value: true },
      { label: "B. Incorrect", value: false },
    ],
    id: [{ label: "A. Benar", value: true }],
  },
  number: 1,
  question: {
    metadata: {
      title: "Question title",
    },
    raw: "Question raw",
  },
};

const exerciseWithoutChoices = {
  answer: {
    raw: "Second answer raw",
  },
  choices: {},
  number: 2,
  question: {
    metadata: {},
    raw: "Second question raw",
  },
};

beforeEach(() => {
  mockCacheLife.mockClear();
  mockCacheTag.mockClear();
  mockGetRuntimeExerciseSetPage.mockReset();

  mockGetRuntimeExerciseSetPage.mockReturnValue(
    Effect.succeed({
      description: "Practice with quantitative reasoning.",
      exercises: [exerciseWithLocalizedChoices, exerciseWithoutChoices],
      title: "Quantitative Knowledge Set 1",
    })
  );
});

describe("llms exercise markdown", () => {
  it("returns null for non-exercise markdown routes", async () => {
    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: "articles/politics/dynastic-politics-asian-values",
        locale: "en",
      })
    ).resolves.toBeNull();

    expect(mockCacheTag).toHaveBeenCalledWith("content-runtime");
    expect(mockCacheLife).toHaveBeenCalledWith("contentRuntime");
  });

  it("returns null when an exercise set has no renderable rows", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({ exercises: [], title: "Empty set" })
    );

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("returns null when the runtime set page is missing", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(Effect.succeed(null));

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("renders set markdown with localized choices and set descriptions", async () => {
    const text = await getCachedLlmsExerciseText({
      cleanSlug: validSetPath,
      locale: "id",
    });

    expect(text).toContain("Practice with quantitative reasoning.");
    expect(text).toContain("## Exercise 1");
    expect(text).toContain("- [x] A. Benar");
    expect(text).toContain("## Exercise 2");
    expect(text).toContain("Second answer raw");
  });

  it("renders one exercise with English choices and title fallback", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [
          exerciseWithoutChoices,
          {
            ...exerciseWithLocalizedChoices,
            choices: {
              en: [{ label: "A. Fallback", value: true }],
            },
            number: 3,
            question: {
              metadata: {},
              raw: "Third question raw",
            },
          },
        ],
        title: "Quantitative Knowledge Set 1",
      })
    );

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/3`,
      locale: "id",
    });

    expect(text).toContain("Quantitative Knowledge Set 1");
    expect(text).toContain("Question 3");
    expect(text).toContain("- [x] A. Fallback");
    expect(text).not.toContain("## Exercise 2");
  });

  it("uses the exercise title when rendering one titled exercise", async () => {
    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/1`,
      locale: "en",
    });

    expect(text).toContain(
      "Practice with quantitative reasoning. - Question title"
    );
  });

  it("returns null when the requested exercise number is missing", async () => {
    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: `${validSetPath}/99`,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("uses the set title when no description exists", async () => {
    mockGetRuntimeExerciseSetPage.mockReturnValue(
      Effect.succeed({
        exercises: [exerciseWithLocalizedChoices],
        title: "Quantitative Knowledge Set 1",
      })
    );

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toContain("Quantitative Knowledge Set 1");
  });
});
