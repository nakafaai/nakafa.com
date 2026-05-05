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
