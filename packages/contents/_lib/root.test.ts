import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const contentsPath = process.cwd();

/**
 * Converts a real package source path into the URL shape passed by `import.meta.url`.
 *
 * @param segments - Path segments below the package root
 * @returns File URL for the requested package source path
 */
function getSourceUrl(...segments: string[]) {
  return pathToFileURL(path.join(contentsPath, ...segments)).href;
}

beforeEach(() => {
  vi.restoreAllMocks();
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

  it("keeps cwd when it is already the contents package", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/packages/contents");

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/packages/contents");
  });

  it("finds the monorepo contents directory from an app cwd", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/apps/www");

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/packages/contents");
  });

  it("finds the monorepo contents directory from a package cwd", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace/packages/backend");

    const result = resolveContentsDir(
      "file:///vercel/path0/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/packages/contents");
  });

  it("falls back to the repo-root contents package for unrecognized cwd", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/workspace");

    const result = resolveContentsDir("file:///var/task/server/chunk.js");

    expect(result).toBe("/workspace/packages/contents");
  });

  it("derives contents root from bundled app file paths when cwd is generic", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/tmp/runtime");

    const result = resolveContentsDir(
      "file:///workspace/apps/www/server/chunk.js"
    );

    expect(result).toBe("/workspace/packages/contents");
  });
});
