import { InvalidPathError } from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetchText, mockReadFile, mockResolveContentsDir } = vi.hoisted(
  () => ({
    mockFetchText: vi.fn(),
    mockReadFile: vi.fn(),
    mockResolveContentsDir: vi.fn(() => "/virtual/contents"),
  })
);

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

vi.mock("@repo/contents/_lib/root", () => ({
  resolveContentsDir: mockResolveContentsDir,
}));

import {
  loadExerciseEntry,
  readExerciseChoices,
} from "@repo/contents/_lib/assessment/source";

/**
 * Runs an Effect and returns its failure value for focused error assertions.
 */
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
  mockReadFile.mockReset();
  mockFetchText.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("readExerciseChoices", () => {
  it("parses math labels with semicolons and braces", async () => {
    mockReadFile.mockResolvedValue(`import type { ExercisesChoices } from "@repo/contents/_types/assessment/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "$$1\\\\frac{1}{8}; 0{,}875; \\\\frac{3}{4}$$",
      value: true,
    },
  ],
  en: [
    {
      label: "$$1\\\\frac{1}{8}; 0.875; \\\\frac{3}{4}$$",
      value: true,
    },
  ],
};

export default choices;`);

    const result = await Effect.runPromise(
      readExerciseChoices(
        "material/practice/assessment/snbt/example/question-1/choices.ts"
      )
    );

    expect(Option.getOrUndefined(result)?.en[0]?.label).toBe(
      "$$1\\frac{1}{8}; 0.875; \\frac{3}{4}$$"
    );
  });

  it("returns Option.none when a choices string is unterminated", async () => {
    mockReadFile.mockResolvedValue(
      'const choices = { id: [{ label: "broken, value: true }], en: [] };'
    );

    const result = await Effect.runPromise(
      readExerciseChoices(
        "material/practice/assessment/snbt/example/question-1/choices.ts"
      )
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it("fails with InvalidPathError for absolute choices paths", async () => {
    const result = await captureFailure(readExerciseChoices("/tmp/choices.ts"));

    expect(result).toBeInstanceOf(InvalidPathError);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("fails with InvalidPathError for traversal below the exercises root", async () => {
    const result = await captureFailure(
      readExerciseChoices("assessment/../choices.ts")
    );

    expect(result).toBeInstanceOf(InvalidPathError);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("fails with InvalidPathError for unsafe material path segments", async () => {
    const result = await captureFailure(
      readExerciseChoices("material/./choices.ts")
    );

    expect(result).toBeInstanceOf(InvalidPathError);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns Option.none for malformed exercise entries before loading files", async () => {
    const loadQuestion = vi.fn(() => Effect.succeed(Option.some("question")));
    const loadAnswer = vi.fn(() => Effect.succeed(Option.some("answer")));
    const loadChoices = vi.fn(() => Effect.succeed(Option.some("choices")));

    const result = await Effect.runPromise(
      loadExerciseEntry("material/practice/assessment/snbt/set-1", "bad", {
        loadAnswer,
        loadChoices,
        loadQuestion,
      })
    );

    expect(Option.isNone(result)).toBe(true);
    expect(loadQuestion).not.toHaveBeenCalled();
    expect(loadAnswer).not.toHaveBeenCalled();
    expect(loadChoices).not.toHaveBeenCalled();
  });
});
