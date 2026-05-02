import path from "node:path";
import { pathToFileURL } from "node:url";
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

const contentsPath = process.cwd();
const sentinels = ["articles", "exercises", "subject"];

/**
 * Converts a real package source path into the URL shape passed by `import.meta.url`.
 *
 * @param segments - Path segments below the package root
 * @returns File URL for the requested package source path
 */
function getSourceUrl(...segments: string[]) {
  return pathToFileURL(path.join(contentsPath, ...segments)).href;
}

/**
 * Mocks the contents sentinel folders for one candidate root.
 *
 * @param directory - Directory that should look like `packages/contents`
 */
function mockContentsRoot(directory: string) {
  const existingPaths = new Set(
    sentinels.map((entry) => path.join(directory, entry))
  );

  mockExistsSync.mockImplementation((filePath: string) =>
    existingPaths.has(filePath)
  );
}

beforeEach(() => {
  mockExistsSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveContentsDir", () => {
  it("finds the contents root from a direct _lib source module", () => {
    const result = resolveContentsDir(getSourceUrl("_lib", "root.ts"));

    expect(result).toBe(contentsPath);
  });

  it("finds the contents root from a nested _lib source module", () => {
    const result = resolveContentsDir(
      getSourceUrl("_lib", "exercises", "source.ts")
    );

    expect(result).toBe(contentsPath);
  });

  it("prefers cwd when it already contains the contents structure", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/apps/www");
    mockContentsRoot("/workspace/apps/www");

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/apps/www");
  });

  it("finds the monorepo contents directory relative to cwd", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/apps/www");
    mockContentsRoot("/workspace/packages/contents");

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/packages/contents");
  });

  it("falls back to the source-relative parent when no candidate matches", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/apps/www");
    mockExistsSync.mockReturnValue(false);

    const result = resolveContentsDir(
      "file:///var/task/apps/www/server/chunk.js"
    );

    expect(result).toBe("/var/task/apps/www");
  });
});
