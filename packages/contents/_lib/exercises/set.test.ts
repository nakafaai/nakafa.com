import { ExerciseLoadError } from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetScopedContent,
  mockGetMDXSlugsForLocale,
  mockFetchText,
  mockReadFile,
  mockResolveContentsDir,
} = vi.hoisted(() => ({
  mockGetScopedContent: vi.fn(),
  mockGetMDXSlugsForLocale: vi.fn(),
  mockFetchText: vi.fn(),
  mockReadFile: vi.fn(),
  mockResolveContentsDir: vi.fn(() => "/virtual/contents"),
}));

vi.mock("@repo/contents/_lib/io/content", async () => {
  const { Effect, Layer } = await import("effect");

  return {
    ContentIO: {
      Default: Layer.empty,
      fetchText: (url: string) =>
        Effect.tryPromise({
          catch: (cause) => cause,
          try: async () => await mockFetchText(url),
        }),
      readFileString: (filePath: string) =>
        Effect.tryPromise({
          catch: (cause) => cause,
          try: async () => await mockReadFile(filePath, "utf8"),
        }),
    },
  };
});

vi.mock("@repo/contents/_lib/mdx-slugs/cache", () => ({
  getMdxSlugsForLocale: (locale: string) =>
    Effect.succeed(mockGetMDXSlugsForLocale(locale)),
}));

vi.mock("@repo/contents/_lib/scoped", () => ({
  getScopedContent: mockGetScopedContent,
}));

vi.mock("@repo/contents/_lib/root", () => ({
  resolveContentsDir: mockResolveContentsDir,
}));

import {
  getExerciseByNumber,
  getExercisesContent,
} from "@repo/contents/_lib/exercises/set";

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
  mockGetScopedContent.mockReset();
  mockReadFile.mockReset();
  mockFetchText.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
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
    mockGetScopedContent.mockImplementation(
      (
        _root: string,
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
    expect(mockGetScopedContent).toHaveBeenCalledTimes(4);
  });

  it("loads exercises via MDX imports and falls back to GitHub choices when needed", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetScopedContent.mockImplementation(
      (_root: string, _locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createMdxContent("Question 1"));
        }

        return Effect.succeed(createMdxContent("Answer 1"));
      }
    );
    mockReadFile.mockRejectedValue(new Error("missing choices file"));
    mockFetchText.mockResolvedValue(createChoicesSource("Remote"));

    const result = await Effect.runPromise(
      getExercisesContent({ filePath: exerciseBasePath, locale: "en" })
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.question.default).toBeDefined();
    expect(result[0]?.choices.en[0]?.label).toBe("Remote EN");
    expect(mockFetchText).toHaveBeenCalledTimes(1);
  });

  it("preserves zero-padded exercise folder names when loading files", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/03/_question`,
      `${exerciseBasePath}/03/_answer`,
    ]);
    mockGetScopedContent.mockImplementation(
      (
        _root: string,
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
    expect(mockGetScopedContent).toHaveBeenNthCalledWith(
      1,
      "exercises",
      "id",
      `${exerciseBasePath}/03/_question`,
      { includeMDX: false }
    );
    expect(mockGetScopedContent).toHaveBeenNthCalledWith(
      2,
      "exercises",
      "id",
      `${exerciseBasePath}/03/_answer`,
      { includeMDX: false }
    );
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining(`${exerciseBasePath}/03/choices.ts`),
      "utf8"
    );
  });

  it("returns an empty array when choices export is missing", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockGetScopedContent.mockReturnValue(
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
    mockGetScopedContent.mockReturnValue(
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
    mockGetScopedContent.mockReturnValue(
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
    mockGetScopedContent.mockImplementation(
      (
        _root: string,
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
    mockGetScopedContent.mockImplementation(
      (
        _root: string,
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
    mockGetScopedContent.mockImplementation(
      (_root: string, _locale: string, filePath: string) => {
        if (filePath.endsWith("1/_question")) {
          return Effect.succeed(createMdxContent("Question 1"));
        }

        return Effect.succeed(createMdxContent("Answer 1"));
      }
    );
    mockReadFile.mockRejectedValue(new Error("missing choices file"));
    mockFetchText.mockImplementation(() => {
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
    mockGetScopedContent.mockImplementation(
      (
        _root: string,
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
    mockGetScopedContent.mockReturnValue(
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
    mockGetScopedContent.mockImplementation(
      (
        _root: string,
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
    expect(mockGetScopedContent).toHaveBeenNthCalledWith(
      1,
      "exercises",
      "id",
      `${exerciseBasePath}/03/_question`,
      { includeMDX: false }
    );
    expect(mockGetScopedContent).toHaveBeenNthCalledWith(
      2,
      "exercises",
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
    mockGetScopedContent.mockImplementation(
      (_root: string, _locale: string, filePath: string) => {
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
