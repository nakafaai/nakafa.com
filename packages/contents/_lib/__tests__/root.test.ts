import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: mockExistsSync,
    },
    existsSync: mockExistsSync,
  };
});

import { resolveContentsDir } from "@repo/contents/_lib/root";

beforeEach(() => {
  vi.spyOn(process, "cwd").mockReturnValue("/workspace/apps/www");
  mockExistsSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveContentsDir", () => {
  it("prefers the current working directory when it already contains the contents structure", () => {
    const existingPaths = new Set([
      "/workspace/apps/www/articles",
      "/workspace/apps/www/exercises",
      "/workspace/apps/www/subject",
    ]);
    mockExistsSync.mockImplementation((filePath: string) => {
      return existingPaths.has(filePath);
    });

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/apps/www");
  });

  it("finds the monorepo contents directory relative to the working directory", () => {
    const existingPaths = new Set([
      "/workspace/packages/contents/articles",
      "/workspace/packages/contents/exercises",
      "/workspace/packages/contents/subject",
    ]);
    mockExistsSync.mockImplementation((filePath: string) => {
      return existingPaths.has(filePath);
    });

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/packages/contents");
  });

  it("falls back to the source-relative directory when no candidate contains the contents structure", () => {
    mockExistsSync.mockReturnValue(false);

    const result = resolveContentsDir(
      "file:///var/task/apps/www/server/chunk.js"
    );

    expect(result).toBe("/var/task/apps/www");
  });
});
