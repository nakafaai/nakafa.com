import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveContentsDir } from "@repo/contents/_lib/root";
import { describe, expect, it } from "vitest";

const contentsPath = process.cwd();

/**
 * Converts a real package source path into the URL shape passed by `import.meta.url`.
 */
function getSourceUrl(...segments: string[]) {
  return pathToFileURL(path.join(contentsPath, ...segments)).href;
}

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

  it("falls back to the file directory when the source is outside _lib", () => {
    const result = resolveContentsDir(getSourceUrl("root.ts"));

    expect(result).toBe(contentsPath);
  });
});
