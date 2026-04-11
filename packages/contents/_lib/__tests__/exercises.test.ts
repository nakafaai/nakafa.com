import { ExerciseLoadError } from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetExerciseContent,
  mockGetFolderChildNames,
  mockGetMDXSlugsForLocale,
  mockHasPathInCache,
  mockKyGet,
  mockReadFile,
  mockResolveContentsDir,
} = vi.hoisted(() => ({
  mockGetExerciseContent: vi.fn(),
  mockGetFolderChildNames: vi.fn(),
  mockGetMDXSlugsForLocale: vi.fn(),
  mockHasPathInCache: vi.fn(),
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
  hasPathInCache: mockHasPathInCache,
}));

vi.mock("@repo/contents/_lib/exercises/content", () => ({
  getExerciseContent: mockGetExerciseContent,
}));

vi.mock("@repo/contents/_lib/fs", () => ({
  getFolderChildNames: mockGetFolderChildNames,
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
  getExerciseSetPaths,
  getExercisesContent,
  getRenderableExerciseByNumber,
  getRenderableExercisesContent,
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
  mockHasPathInCache.mockReturnValue(false);
  mockGetFolderChildNames.mockReturnValue(Effect.succeed([]));
  mockGetExerciseContent.mockReset();
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

describe("getExerciseSetPaths", () => {
  it("collects unique exercise set paths from question and answer slugs", () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      `${exerciseBasePath}/2/_question`,
      "exercises/high-school/snbt/general-knowledge/try-out/2026/set-2/1/_answer",
    ]);

    const result = getExerciseSetPaths("id");

    expect(result).toStrictEqual([
      "exercises/high-school/snbt/general-knowledge/try-out/2026/set-2",
      exerciseBasePath,
    ]);
  });

  it("ignores exercise collection folders and unrelated slugs", () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
      `${exerciseBasePath}/1/choices`,
      "articles/politics/dynastic-politics-asian-values",
    ]);

    const result = getExerciseSetPaths("en");

    expect(result).toStrictEqual([]);
  });

  it("ignores malformed exercise slugs without trailing segments", () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/_question",
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
      "exercises",
    ]);

    const result = getExerciseSetPaths("en");

    expect(result).toStrictEqual([]);
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
    mockGetExerciseContent.mockImplementation(
      (
        _locale: string,
        filePath: string,
        options?: { includeMDX?: boolean }
      ) => {
        if (options?.includeMDX !== false) {
          return Effect.fail(new Error("Expected metadata-only load"));
        }

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
    expect(mockGetExerciseContent).toHaveBeenCalledTimes(4);
  });

  it("loads exercises via MDX imports and falls back to GitHub choices when needed", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetExerciseContent.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createMdxContent("Question 1"));
        }

        return Effect.succeed(createMdxContent("Answer 1"));
      }
    );
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

  it("preserves zero-padded exercise folder names when loading files", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/03/_question`,
      `${exerciseBasePath}/03/_answer`,
    ]);
    mockGetExerciseContent.mockImplementation(
      (
        _locale: string,
        filePath: string,
        options?: { includeMDX?: boolean }
      ) => {
        if (options?.includeMDX !== false) {
          return Effect.fail(new Error("Expected metadata-only load"));
        }

        if (filePath.endsWith("03/_question")) {
          return Effect.succeed(createRawContent("Question 03"));
        }

        return Effect.succeed(createRawContent("Answer 03"));
      }
    );
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("03/choices.ts")) {
        return Promise.resolve(createChoicesSource("Three"));
      }

      return Promise.reject(new Error(`Unexpected path: ${filePath}`));
    });

    const result = await Effect.runPromise(
      getExercisesContent({
        filePath: exerciseBasePath,
        includeMDX: false,
        locale: "id",
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.number).toBe(3);
    expect(mockGetExerciseContent).toHaveBeenNthCalledWith(
      1,
      "id",
      `${exerciseBasePath}/03/_question`,
      { includeMDX: false }
    );
    expect(mockGetExerciseContent).toHaveBeenNthCalledWith(
      2,
      "id",
      `${exerciseBasePath}/03/_answer`,
      { includeMDX: false }
    );
    expect(mockReadFile).toHaveBeenCalledWith(
      "/virtual/contents/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/03/choices.ts",
      "utf8"
    );
  });

  it("returns an empty array when choices export is missing", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetExerciseContent.mockReturnValue(
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
    mockGetExerciseContent.mockReturnValue(
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
    mockGetExerciseContent.mockReturnValue(
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
    mockGetExerciseContent.mockImplementation(
      (
        _locale: string,
        filePath: string,
        options?: { includeMDX?: boolean }
      ) => {
        if (options?.includeMDX !== false) {
          return Effect.fail(new Error("Expected metadata-only load"));
        }

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
    mockGetExerciseContent.mockImplementation(
      (
        _locale: string,
        filePath: string,
        options?: { includeMDX?: boolean }
      ) => {
        if (options?.includeMDX !== false) {
          return Effect.fail(new Error("Expected metadata-only load"));
        }

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
    mockGetExerciseContent.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createMdxContent("Question 1"));
        }

        return Effect.succeed(createMdxContent("Answer 1"));
      }
    );
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
    mockHasPathInCache.mockImplementation(
      (_locale: string, filePath: string) =>
        filePath.endsWith("2/_question") || filePath.endsWith("2/_answer")
    );
    mockGetExerciseContent.mockImplementation(
      (
        _locale: string,
        filePath: string,
        options?: { includeMDX?: boolean }
      ) => {
        if (options?.includeMDX !== false) {
          return Effect.fail(new Error("Expected metadata-only load"));
        }

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
    mockHasPathInCache.mockReturnValue(false);
    mockGetExerciseContent.mockReturnValue(
      Effect.succeed(createRawContent("Exercise"))
    );
    mockReadFile.mockResolvedValue(createChoicesSource("Only"));

    const result = await Effect.runPromise(
      getExerciseByNumber("id", exerciseBasePath, 99, false)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("matches zero-padded exercise folders by numeric exercise number", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/03/_question`,
      `${exerciseBasePath}/03/_answer`,
    ]);
    mockGetExerciseContent.mockImplementation(
      (
        _locale: string,
        filePath: string,
        options?: { includeMDX?: boolean }
      ) => {
        if (options?.includeMDX !== false) {
          return Effect.fail(new Error("Expected metadata-only load"));
        }

        if (filePath.endsWith("03/_question")) {
          return Effect.succeed(createRawContent("Question 03"));
        }

        return Effect.succeed(createRawContent("Answer 03"));
      }
    );
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("03/choices.ts")) {
        return Promise.resolve(createChoicesSource("Three"));
      }

      return Promise.reject(new Error(`Unexpected path: ${filePath}`));
    });

    const result = await Effect.runPromise(
      getExerciseByNumber("id", exerciseBasePath, 3, false)
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrUndefined(result)?.number).toBe(3);
    expect(mockGetExerciseContent).toHaveBeenNthCalledWith(
      1,
      "id",
      `${exerciseBasePath}/03/_question`,
      { includeMDX: false }
    );
    expect(mockGetExerciseContent).toHaveBeenNthCalledWith(
      2,
      "id",
      `${exerciseBasePath}/03/_answer`,
      { includeMDX: false }
    );
  });

  it("uses the default includeMDX value when the fourth argument is omitted", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockHasPathInCache.mockImplementation(
      (_locale: string, filePath: string) =>
        filePath.endsWith("1/_question") || filePath.endsWith("1/_answer")
    );
    mockGetExerciseContent.mockImplementation(
      (_locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createMdxContent("Question 1"));
        }

        return Effect.succeed(createMdxContent("Answer 1"));
      }
    );
    mockReadFile.mockResolvedValue(createChoicesSource("Default"));

    const result = await Effect.runPromise(
      getExerciseByNumber("en", exerciseBasePath, 1)
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrUndefined(result)?.question.default).toBeDefined();
  });
});

describe("getRenderableExercisesContent", () => {
  it("loads plain exercise rows from local mdx files and choices", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      `${exerciseBasePath}/2/_question`,
      `${exerciseBasePath}/2/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 1'
        );
      }

      if (filePath.endsWith("2/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 2", description: "Q2", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 2'
        );
      }

      if (filePath.endsWith("2/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 2", description: "A2", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 2'
        );
      }

      if (filePath.endsWith("1/choices.ts")) {
        return Promise.resolve(createChoicesSource("One"));
      }

      return Promise.resolve(createChoicesSource("Two"));
    });

    const result = await getRenderableExercisesContent("id", exerciseBasePath);

    expect(result).toHaveLength(2);
    expect(result.map((exercise) => exercise.number)).toStrictEqual([1, 2]);
    expect(result[0]?.question.metadata.title).toBe("Question 1");
    expect(result[1]?.choices.id[0]?.label).toBe("Two ID");
  });

  it("falls back to GitHub raw choices when the local choices file is missing", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("choices.ts")) {
        return Promise.reject(new Error("missing choices file"));
      }

      if (filePath.endsWith("_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      return Promise.resolve(
        'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 1'
      );
    });
    mockKyGet.mockReturnValue({
      text: () => Promise.resolve(createChoicesSource("Remote")),
    });

    const result = await getRenderableExercisesContent("en", exerciseBasePath);

    expect(result).toHaveLength(1);
    expect(result[0]?.choices.en[0]?.label).toBe("Remote EN");
    expect(mockKyGet).toHaveBeenCalledTimes(1);
  });

  it("skips incomplete exercises when metadata or choices are missing", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
      `${exerciseBasePath}/2/_question`,
      `${exerciseBasePath}/2/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 1'
        );
      }

      if (filePath.endsWith("1/choices.ts")) {
        return Promise.resolve(createChoicesSource("One"));
      }

      if (filePath.endsWith("2/choices.ts")) {
        return Promise.resolve("const choices = invalid;");
      }

      return Promise.resolve("## Missing metadata");
    });

    const result = await getRenderableExercisesContent("id", exerciseBasePath);

    expect(result).toHaveLength(1);
    expect(result[0]?.number).toBe(1);
  });
});

describe("getRenderableExerciseByNumber", () => {
  it("loads one matching exercise row by number", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/03/_question`,
      `${exerciseBasePath}/03/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("03/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 03", description: "Q3", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 03'
        );
      }

      if (filePath.endsWith("03/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 03", description: "A3", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 03'
        );
      }

      return Promise.resolve(createChoicesSource("Three"));
    });

    const result = await getRenderableExerciseByNumber(
      "id",
      exerciseBasePath,
      3
    );

    expect(result?.number).toBe(3);
    expect(result?.choices.id[0]?.label).toBe("Three ID");
  });

  it("returns null when the requested number is not present", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);

    const result = await getRenderableExerciseByNumber(
      "en",
      exerciseBasePath,
      9
    );

    expect(result).toBeNull();
  });

  it("returns null when the choices source cannot be evaluated", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 1'
        );
      }

      return Promise.resolve("const choices = { broken:");
    });

    const result = await getRenderableExerciseByNumber(
      "en",
      exerciseBasePath,
      1
    );

    expect(result).toBeNull();
  });

  it("returns null when the choices expression throws during evaluation", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 1'
        );
      }

      return Promise.resolve("const choices = { broken: foo };");
    });

    const result = await getRenderableExerciseByNumber(
      "en",
      exerciseBasePath,
      1
    );

    expect(result).toBeNull();
  });

  it("returns null when the choices expression shape fails schema validation", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Answer 1'
        );
      }

      return Promise.resolve("const choices = { id: 'wrong', en: [] };");
    });

    const result = await getRenderableExerciseByNumber(
      "en",
      exerciseBasePath,
      1
    );

    expect(result).toBeNull();
  });

  it("returns null when a renderable exercise path escapes the contents root", async () => {
    const unsafePath = "../outside";
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${unsafePath}/1/_question`,
      `${unsafePath}/1/_answer`,
    ]);

    const result = await getRenderableExerciseByNumber("en", unsafePath, 1);

    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns null when a renderable exercise mdx file cannot be read", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "01/01/2024" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.reject(new Error("missing answer mdx"));
      }

      return Promise.resolve(createChoicesSource("One"));
    });

    const result = await getRenderableExerciseByNumber(
      "id",
      exerciseBasePath,
      1
    );

    expect(result).toBeNull();
  });
});

describe("getRenderableExercisesContent edge cases", () => {
  it("returns an empty array when no renderable exercise numbers exist", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([]);

    const result = await getRenderableExercisesContent("en", exerciseBasePath);

    expect(result).toStrictEqual([]);
  });
});
