import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedLlmsExerciseText,
  getExerciseRouteMetadata,
  getExerciseSetRoutes,
  hasExerciseMarkdownRoute,
} from "@/lib/llms/exercises";

const mockCacheLife = vi.hoisted(() => vi.fn());
const mockGetCurrentMaterial = vi.hoisted(() => vi.fn());
const mockGetExerciseSetPaths = vi.hoisted(() => vi.fn());
const mockGetMaterialPath = vi.hoisted(() => vi.fn());
const mockGetMaterials = vi.hoisted(() => vi.fn());
const mockGetRenderableExercisesContent = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  cacheLife: mockCacheLife,
}));

vi.mock("@repo/contents/_lib/exercises/collection", () => ({
  getExerciseSetPaths: mockGetExerciseSetPaths,
}));

vi.mock("@repo/contents/_lib/exercises/material", () => ({
  getCurrentMaterial: mockGetCurrentMaterial,
  getMaterialPath: mockGetMaterialPath,
  getMaterials: mockGetMaterials,
}));

vi.mock("@repo/contents/_lib/exercises/renderable", () => ({
  getRenderableExercisesContent: mockGetRenderableExercisesContent,
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
  mockGetCurrentMaterial.mockReset();
  mockGetExerciseSetPaths.mockReset();
  mockGetMaterialPath.mockReset();
  mockGetMaterials.mockReset();
  mockGetRenderableExercisesContent.mockReset();

  mockGetExerciseSetPaths.mockReturnValue([validSetPath]);
  mockGetMaterialPath.mockReturnValue(
    "/exercises/high-school/snbt/quantitative-knowledge"
  );
  mockGetMaterials.mockResolvedValue([]);
  mockGetCurrentMaterial.mockReturnValue({
    currentMaterial: {
      description: "Practice with quantitative reasoning.",
      items: [],
      title: "Quantitative Knowledge",
    },
    currentMaterialItem: {
      href: `/${validSetPath}`,
      title: "Set 1",
    },
  });
  mockGetRenderableExercisesContent.mockResolvedValue([
    exerciseWithLocalizedChoices,
    exerciseWithoutChoices,
  ]);
});

describe("llms exercise metadata", () => {
  it("detects set and numbered exercise markdown routes", () => {
    const exerciseSetRoutes = getExerciseSetRoutes("en");

    expect(exerciseSetRoutes.has(`/${validSetPath}`)).toBe(true);
    expect(
      hasExerciseMarkdownRoute(`/${validSetPath}`, exerciseSetRoutes)
    ).toBe(true);
    expect(
      hasExerciseMarkdownRoute(`/${validSetPath}/2`, exerciseSetRoutes)
    ).toBe(true);
    expect(
      hasExerciseMarkdownRoute(`/${validSetPath}/summary`, exerciseSetRoutes)
    ).toBe(false);
    expect(
      hasExerciseMarkdownRoute("/exercises/other/set/2", exerciseSetRoutes)
    ).toBe(false);
    expect(
      getExerciseRouteMetadata({
        exerciseSetRoutes,
        route: `/${validSetPath}/2`,
      })
    ).toEqual({
      description: undefined,
      hasMarkdown: true,
      title: "2",
    });
  });
});

describe("llms exercise markdown", () => {
  it("returns null for non-exercise markdown routes", async () => {
    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: "articles/story",
        locale: "en",
      })
    ).resolves.toBeNull();

    expect(mockCacheLife).toHaveBeenCalledWith("max");
  });

  it("returns null when an exercise set has no renderable rows", async () => {
    mockGetRenderableExercisesContent.mockResolvedValue([]);

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toBeNull();
  });

  it("renders set markdown with localized choices and material descriptions", async () => {
    const text = await getCachedLlmsExerciseText({
      cleanSlug: validSetPath,
      locale: "id",
    });

    expect(text).toContain(
      "Exercises: Quantitative Knowledge - Set 1: Practice with quantitative reasoning."
    );
    expect(text).toContain("## Exercise 1");
    expect(text).toContain("- [x] A. Benar");
    expect(text).toContain("## Exercise 2");
    expect(text).toContain("Second answer raw");
  });

  it("renders one exercise with English choices and title fallback", async () => {
    mockGetRenderableExercisesContent.mockResolvedValue([
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
    ]);
    mockGetCurrentMaterial.mockReturnValue({
      currentMaterial: {
        items: [],
        title: "Quantitative Knowledge",
      },
      currentMaterialItem: {
        href: `/${validSetPath}`,
        title: "Set 1",
      },
    });

    const text = await getCachedLlmsExerciseText({
      cleanSlug: `${validSetPath}/3`,
      locale: "id",
    });

    expect(text).toContain("Exercises: Quantitative Knowledge - Set 1");
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
      "Exercises: Quantitative Knowledge - Set 1: Practice with quantitative reasoning. - Question title"
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

  it("uses the generic description for invalid or unmatched material paths", async () => {
    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: "exercises/invalid/type/material/set-1",
        locale: "en",
      })
    ).resolves.toContain("Exercises Content");

    mockGetCurrentMaterial.mockReturnValue({
      currentMaterial: undefined,
      currentMaterialItem: undefined,
    });

    await expect(
      getCachedLlmsExerciseText({
        cleanSlug: validSetPath,
        locale: "en",
      })
    ).resolves.toContain("Exercises Content");
  });
});
