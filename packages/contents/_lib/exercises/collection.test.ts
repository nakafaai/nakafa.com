import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetFolderChildNames, mockGetMDXSlugsForLocale } = vi.hoisted(
  () => ({
    mockGetFolderChildNames: vi.fn(),
    mockGetMDXSlugsForLocale: vi.fn(),
  })
);

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  getMdxSlugsForLocale: (locale: string) =>
    Effect.succeed(mockGetMDXSlugsForLocale(locale)),
}));

vi.mock("@repo/contents/_lib/fs/cache", () => ({
  getFolderChildNames: mockGetFolderChildNames,
}));

import {
  getExerciseCount,
  getExerciseQuestionNumbers,
  getExerciseSetPathsFromSlugs,
} from "@repo/contents/_lib/exercises/collection";

const exerciseBasePath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

beforeEach(() => {
  mockGetMDXSlugsForLocale.mockReturnValue([]);
  mockGetFolderChildNames.mockReturnValue(Effect.succeed([]));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getExerciseCount", () => {
  it("counts only numeric child directories", async () => {
    mockGetFolderChildNames.mockReturnValue(
      Effect.succeed(["1", "draft", "2", "03", "notes"])
    );

    const result = await Effect.runPromise(getExerciseCount(exerciseBasePath));

    expect(result).toBe(3);
    expect(mockGetFolderChildNames).toHaveBeenCalledWith(exerciseBasePath);
  });

  it("returns zero when child directory lookup fails", async () => {
    mockGetFolderChildNames.mockReturnValue(Effect.fail(new Error("missing")));

    const result = await Effect.runPromise(getExerciseCount(exerciseBasePath));

    expect(result).toBe(0);
  });
});

describe("getExerciseQuestionNumbers", () => {
  it("collects direct exercise numbers from a set path", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/2/_answer`,
        `${exerciseBasePath}/1/_question`,
        `${exerciseBasePath}/1/_answer`,
        `${exerciseBasePath}/10/_question`,
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["1", "2", "10"]);
  });

  it("skips slugs outside the requested exercise set", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/1/_question`,
        "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9/_answer",
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["1"]);
  });

  it("supports empty base paths when scanning already-trimmed slugs", () => {
    const result = getExerciseQuestionNumbers(
      ["1/_question", "1/_answer", "2/_question"],
      ""
    );

    expect(result).toStrictEqual(["1", "2"]);
  });

  it("ignores yearly collection folders that are not direct exercise numbers", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/1/_question`,
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/1/_answer",
      ],
      "exercises/high-school/snbt/quantitative-knowledge/try-out"
    );

    expect(result).toStrictEqual([]);
  });

  it("ignores nested entries that are not question or answer folders", () => {
    const result = getExerciseQuestionNumbers(
      [
        `${exerciseBasePath}/1/choices`,
        `${exerciseBasePath}/2/notes`,
        `${exerciseBasePath}/3/_question`,
      ],
      exerciseBasePath
    );

    expect(result).toStrictEqual(["3"]);
  });
});

describe("getExerciseSetPathsFromSlugs", () => {
  it("collects set paths without rereading the MDX cache", () => {
    const result = getExerciseSetPathsFromSlugs([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      "articles/politics/dynastic-politics-asian-values",
    ]);

    expect(result).toStrictEqual([exerciseBasePath]);
    expect(mockGetMDXSlugsForLocale).not.toHaveBeenCalled();
  });
});
