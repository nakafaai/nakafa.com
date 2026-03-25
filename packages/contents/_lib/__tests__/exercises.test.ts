import { ExerciseLoadError } from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetContent,
  mockGetContentMetadataWithRaw,
  mockGetFolderChildNames,
  mockGetMDXSlugsForLocale,
  mockKyGet,
  mockReadFile,
  mockResolveContentsDir,
} = vi.hoisted(() => ({
  mockGetContent: vi.fn(),
  mockGetContentMetadataWithRaw: vi.fn(),
  mockGetFolderChildNames: vi.fn(),
  mockGetMDXSlugsForLocale: vi.fn(),
  mockKyGet: vi.fn(),
  mockReadFile: vi.fn(),
  mockResolveContentsDir: vi.fn(() => "/virtual/contents"),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: mockReadFile,
    },
  };
});

vi.mock("@repo/contents/_lib/cache", () => ({
  getMDXSlugsForLocale: mockGetMDXSlugsForLocale,
}));

vi.mock("@repo/contents/_lib/content", () => ({
  getContent: mockGetContent,
}));

vi.mock("@repo/contents/_lib/fs", () => ({
  getFolderChildNames: mockGetFolderChildNames,
}));

vi.mock("@repo/contents/_lib/metadata", () => ({
  getContentMetadataWithRaw: mockGetContentMetadataWithRaw,
}));

vi.mock("@repo/contents/_lib/root", () => ({
  resolveContentsDir: mockResolveContentsDir,
}));

vi.mock("ky", () => ({
  default: {
    get: mockKyGet,
  },
}));

import {
  getExerciseByNumber,
  getExerciseCount,
  getExerciseQuestionNumbers,
  getExercisesContent,
} from "@repo/contents/_lib/exercises";

const exerciseBasePath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

function createMetadata(title: string) {
  return {
    authors: [{ name: `${title} Author` }],
    date: "01/01/2024",
    description: `${title} Description`,
    title,
  };
}

function createRawContent(title: string) {
  return {
    metadata: createMetadata(title),
    raw: `# ${title}`,
  };
}

function createMdxContent(title: string) {
  return {
    ...createRawContent(title),
    default: createElement("div", null, title),
  };
}

function createChoicesSource(label: string) {
  return `const choices = {
  id: [{ label: "${label} ID", value: true }],
  en: [{ label: "${label} EN", value: false }],
};`;
}

async function captureFailure<TSuccess, TError>(
  effect: Effect.Effect<TSuccess, TError>
) {
  return await Effect.runPromise(
    Effect.match(effect, {
      onFailure: (error) => error,
      onSuccess: () => null,
    })
  );
}

beforeEach(() => {
  mockResolveContentsDir.mockReturnValue("/virtual/contents");
  mockGetMDXSlugsForLocale.mockReturnValue([]);
  mockGetFolderChildNames.mockReturnValue(Effect.succeed([]));
  mockGetContentMetadataWithRaw.mockReset();
  mockGetContent.mockReset();
  mockReadFile.mockReset();
  mockKyGet.mockReset();
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

describe("getExercisesContent", () => {
  it("returns an empty array when no exercise slugs exist", async () => {
    const result = await Effect.runPromise(
      getExercisesContent({ filePath: exerciseBasePath, locale: "id" })
    );

    expect(result).toStrictEqual([]);
  });

  it("loads exercises from metadata and local choices files without MDX imports", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/2/_answer`,
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      `${exerciseBasePath}/2/_question`,
    ]);
    mockGetContentMetadataWithRaw.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createRawContent("Question 1"));
        }

        if (filePath.endsWith("1/_answer")) {
          return Effect.succeed(createRawContent("Answer 1"));
        }

        if (filePath.endsWith("2/_question")) {
          return Effect.succeed(createRawContent("Question 2"));
        }

        return Effect.succeed(createRawContent("Answer 2"));
      }
    );
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/choices.ts")) {
        return Promise.resolve(createChoicesSource("One"));
      }

      return Promise.resolve(createChoicesSource("Two"));
    });

    const result = await Effect.runPromise(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(result).toHaveLength(2);
    expect(result.map((exercise) => exercise.number)).toStrictEqual([1, 2]);
    expect(result[0]?.question.default).toBeUndefined();
    expect(result[0]?.choices.id[0]?.label).toBe("One ID");
    expect(mockGetContentMetadataWithRaw).toHaveBeenCalledTimes(4);
  });

  it("loads exercises via MDX imports and falls back to GitHub choices when needed", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContent.mockImplementation((_locale: string, filePath: string) => {
      if (filePath.endsWith("1/_question")) {
        return Effect.succeed(createMdxContent("Question 1"));
      }

      return Effect.succeed(createMdxContent("Answer 1"));
    });
    mockReadFile.mockRejectedValue(new Error("missing choices file"));
    mockKyGet.mockReturnValue({
      text: () => Promise.resolve(createChoicesSource("Remote")),
    });

    const result = await Effect.runPromise(
      getExercisesContent({ filePath: exerciseBasePath, locale: "en" })
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.question.default).toBeDefined();
    expect(result[0]?.choices.en[0]?.label).toBe("Remote EN");
    expect(mockKyGet).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array when choices export is missing", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockReturnValue(
      Effect.succeed(createRawContent("Exercise"))
    );
    mockReadFile.mockResolvedValue("export const metadata = {};");

    const result = await Effect.runPromise(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when choices fail schema validation", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockReturnValue(
      Effect.succeed(createRawContent("Exercise"))
    );
    mockReadFile.mockResolvedValue(
      "const choices = { id: 'invalid', en: [{ label: 'A', value: true }] };"
    );

    const result = await Effect.runPromise(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(result).toStrictEqual([]);
  });

  it("returns an empty array when choices source cannot be parsed as JavaScript", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockReturnValue(
      Effect.succeed(createRawContent("Exercise"))
    );
    mockReadFile.mockResolvedValue(
      "const choices = { id: [{ label: 'A', value: true }], en: [ };"
    );

    const result = await Effect.runPromise(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(result).toStrictEqual([]);
  });

  it("fails when the question content cannot be loaded", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.fail(new Error("missing question"));
        }

        return Effect.succeed(createRawContent("Answer 1"));
      }
    );
    mockReadFile.mockResolvedValue(createChoicesSource("Valid"));

    const failure = await captureFailure(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(failure).toBeInstanceOf(ExerciseLoadError);
    expect(failure).toMatchObject({ path: `${exerciseBasePath}/1/_question` });
  });

  it("fails when the answer content cannot be loaded", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_answer")) {
          return Effect.fail(new Error("missing answer"));
        }

        return Effect.succeed(createRawContent("Question 1"));
      }
    );
    mockReadFile.mockResolvedValue(createChoicesSource("Valid"));

    const failure = await captureFailure(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(failure).toBeInstanceOf(ExerciseLoadError);
    expect(failure).toMatchObject({ path: `${exerciseBasePath}/1/_answer` });
  });

  it("fails when choices cannot be read locally or from GitHub", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContent.mockImplementation((_locale: string, filePath: string) => {
      if (filePath.endsWith("1/_question")) {
        return Effect.succeed(createMdxContent("Question 1"));
      }

      return Effect.succeed(createMdxContent("Answer 1"));
    });
    mockReadFile.mockRejectedValue(new Error("missing choices file"));
    mockKyGet.mockImplementation(() => {
      throw new Error("GitHub unavailable");
    });

    const failure = await captureFailure(
      getExercisesContent({ filePath: exerciseBasePath, locale: "en" })
    );

    expect(failure).toBeInstanceOf(ExerciseLoadError);
    expect(failure).toMatchObject({ path: `${exerciseBasePath}/1/choices.ts` });
  });
});

describe("getExerciseByNumber", () => {
  it("returns the requested exercise when present", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      `${exerciseBasePath}/2/_question`,
      `${exerciseBasePath}/2/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createRawContent("Question 1"));
        }

        if (filePath.endsWith("1/_answer")) {
          return Effect.succeed(createRawContent("Answer 1"));
        }

        if (filePath.endsWith("2/_question")) {
          return Effect.succeed(createRawContent("Question 2"));
        }

        return Effect.succeed(createRawContent("Answer 2"));
      }
    );
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/choices.ts")) {
        return Promise.resolve(createChoicesSource("One"));
      }

      return Promise.resolve(createChoicesSource("Two"));
    });

    const result = await Effect.runPromise(
      getExerciseByNumber("id", exerciseBasePath, 2, false)
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrUndefined(result)?.number).toBe(2);
  });

  it("returns none when the requested exercise number does not exist", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContentMetadataWithRaw.mockReturnValue(
      Effect.succeed(createRawContent("Exercise"))
    );
    mockReadFile.mockResolvedValue(createChoicesSource("Only"));

    const result = await Effect.runPromise(
      getExerciseByNumber("id", exerciseBasePath, 99, false)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("uses the default includeMDX value when the fourth argument is omitted", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetContent.mockImplementation((_locale: string, filePath: string) => {
      if (filePath.endsWith("1/_question")) {
        return Effect.succeed(createMdxContent("Question 1"));
      }

      return Effect.succeed(createMdxContent("Answer 1"));
    });
    mockReadFile.mockResolvedValue(createChoicesSource("Default"));

    const result = await Effect.runPromise(
      getExerciseByNumber("en", exerciseBasePath, 1)
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrUndefined(result)?.question.default).toBeDefined();
  });
});
