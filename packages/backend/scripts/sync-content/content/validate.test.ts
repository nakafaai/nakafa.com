import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validate } from "./validate";

const globPatterns = vi.hoisted((): string[] => []);
const sourceLoads = vi.hoisted(() => ({ count: 0 }));

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  /** Records validation globs without touching the filesystem. */
  globFiles: (pattern: string) => {
    globPatterns.push(pattern);
    return Effect.succeed([]);
  },
}));

vi.mock("@repo/contents/_lib/mdx-slugs/source", () => ({
  readMdxSlugManifest: () => Effect.void,
}));

vi.mock("@repo/contents/_types/material/registry", () => ({
  listLessonRows: () => [],
}));

vi.mock("@repo/contents/_types/tryout/source", () => {
  sourceLoads.count++;
  return { TRYOUT_SOURCES: [] };
});

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  formatDuration: () => "0ms",
  log: () => undefined,
  logError: () => undefined,
  logSuccess: () => undefined,
}));

describe("content validation", () => {
  beforeEach(() => {
    globPatterns.length = 0;
  });

  it("does not load filesystem tryouts after signed ownership activates", async () => {
    expect(sourceLoads.count).toBe(0);

    await Effect.runPromise(validate({ tryoutsManaged: true }));

    expect(sourceLoads.count).toBe(0);
    expect(globPatterns).toEqual([
      "articles/**/*.mdx",
      "material/lesson/**/*.mdx",
    ]);
  });
});
