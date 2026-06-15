import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMDXSlugsForLocale,
  mockFetchText,
  mockReadFile,
  mockResolveContentsDir,
} = vi.hoisted(() => ({
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

vi.mock("@repo/contents/_lib/root", () => ({
  resolveContentsDir: mockResolveContentsDir,
}));

import {
  getRenderableExerciseByNumber,
  getRenderableExercisesContent,
} from "@repo/contents/_lib/exercises/renderable";
import { Effect, Option } from "effect";

const exerciseBasePath =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1";

function createChoicesSource(label: string) {
  return `const choices = {
  id: [{ label: "${label} ID", value: true }],
  en: [{ label: "${label} EN", value: false }],
};`;
}

beforeEach(() => {
  mockResolveContentsDir.mockReturnValue("/virtual/contents");
  mockGetMDXSlugsForLocale.mockReturnValue([]);
  mockReadFile.mockReset();
  mockFetchText.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
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
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
        );
      }

      if (filePath.endsWith("2/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 2", description: "Q2", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 2'
        );
      }

      if (filePath.endsWith("2/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 2", description: "A2", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 2'
        );
      }

      if (filePath.endsWith("1/choices.ts")) {
        return Promise.resolve(createChoicesSource("One"));
      }

      return Promise.resolve(createChoicesSource("Two"));
    });

    const result = await Effect.runPromise(
      getRenderableExercisesContent("id", exerciseBasePath)
    );

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
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      return Promise.resolve(
        'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
      );
    });
    mockFetchText.mockResolvedValue(createChoicesSource("Remote"));

    const result = await Effect.runPromise(
      getRenderableExercisesContent("en", exerciseBasePath)
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.choices.en[0]?.label).toBe("Remote EN");
    expect(mockFetchText).toHaveBeenCalledTimes(1);
  });

  it("skips exercises when local and remote choices are unavailable", async () => {
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
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      return Promise.resolve(
        'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
      );
    });
    mockFetchText.mockRejectedValue(new Error("remote choices unavailable"));

    const result = await Effect.runPromise(
      getRenderableExercisesContent("en", exerciseBasePath)
    );

    expect(result).toStrictEqual([]);
    expect(mockFetchText).toHaveBeenCalledTimes(1);
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
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
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

    const result = await Effect.runPromise(
      getRenderableExercisesContent("id", exerciseBasePath)
    );

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
          'export const metadata = { title: "Question 03", description: "Q3", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 03'
        );
      }

      if (filePath.endsWith("03/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 03", description: "A3", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 03'
        );
      }

      return Promise.resolve(createChoicesSource("Three"));
    });

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("id", exerciseBasePath, 3)
    );

    expect(Option.isSome(result)).toBe(true);
    expect(Option.getOrUndefined(result)?.number).toBe(3);
    expect(Option.getOrUndefined(result)?.choices.id[0]?.label).toBe(
      "Three ID"
    );
  });

  it("returns none when the requested number is not present", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("en", exerciseBasePath, 9)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when the choices source cannot be evaluated", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
        );
      }

      return Promise.resolve("const choices = { broken:");
    });

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("en", exerciseBasePath, 1)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when the choices expression throws during evaluation", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
        );
      }

      return Promise.resolve("const choices = { broken: foo };");
    });

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("en", exerciseBasePath, 1)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when the choices expression shape fails schema validation", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Answer 1", description: "A1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Answer 1'
        );
      }

      return Promise.resolve("const choices = { id: 'wrong', en: [] };");
    });

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("en", exerciseBasePath, 1)
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("returns none when a renderable exercise path escapes the contents root", async () => {
    const unsafePath = "../outside";
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${unsafePath}/1/_question`,
      `${unsafePath}/1/_answer`,
    ]);

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("en", unsafePath, 1)
    );

    expect(Option.isNone(result)).toBe(true);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns none when a renderable exercise mdx file cannot be read", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([
      `${exerciseBasePath}/1/_question`,
      `${exerciseBasePath}/1/_answer`,
    ]);
    mockReadFile.mockImplementation((filePath: string) => {
      if (filePath.endsWith("1/_question/id.mdx")) {
        return Promise.resolve(
          'export const metadata = { title: "Question 1", description: "Q1", authors: [{ name: "Author" }], date: "2024-01-01" };\n\n## Question 1'
        );
      }

      if (filePath.endsWith("1/_answer/id.mdx")) {
        return Promise.reject(new Error("missing answer mdx"));
      }

      return Promise.resolve(createChoicesSource("One"));
    });

    const result = await Effect.runPromise(
      getRenderableExerciseByNumber("id", exerciseBasePath, 1)
    );

    expect(Option.isNone(result)).toBe(true);
  });
});

describe("getRenderableExercisesContent edge cases", () => {
  it("returns an empty array when no renderable exercise numbers exist", async () => {
    mockGetMDXSlugsForLocale.mockReturnValue([]);

    const result = await Effect.runPromise(
      getRenderableExercisesContent("en", exerciseBasePath)
    );

    expect(result).toStrictEqual([]);
  });
});
