import { InvalidPathError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockKyGet, mockReadFile, mockResolveContentsDir } = vi.hoisted(() => ({
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

vi.mock("@repo/contents/_lib/root", () => ({
  resolveContentsDir: mockResolveContentsDir,
}));

vi.mock("ky", () => ({
  default: {
    get: mockKyGet,
  },
}));

import { readExerciseChoices } from "@repo/contents/_lib/exercises/source";

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
  mockKyGet.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("readExerciseChoices", () => {
  it("parses math labels with semicolons and braces", async () => {
    mockReadFile.mockResolvedValue(`import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

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
      readExerciseChoices("exercises/high-school/snbt/example/choices.ts")
    );

    expect(result?.en[0]?.label).toBe("$$1\\frac{1}{8}; 0.875; \\frac{3}{4}$$");
  });

  it("returns null when a choices string is unterminated", async () => {
    mockReadFile.mockResolvedValue(
      'const choices = { id: [{ label: "broken, value: true }], en: [] };'
    );

    const result = await Effect.runPromise(
      readExerciseChoices("exercises/high-school/snbt/example/choices.ts")
    );

    expect(result).toBeNull();
  });

  it("fails with InvalidPathError for absolute choices paths", async () => {
    const result = await captureFailure(readExerciseChoices("/tmp/choices.ts"));

    expect(result).toBeInstanceOf(InvalidPathError);
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("fails with InvalidPathError for traversal below the exercises root", async () => {
    const result = await captureFailure(
      readExerciseChoices("exercises/../choices.ts")
    );

    expect(result).toBeInstanceOf(InvalidPathError);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
