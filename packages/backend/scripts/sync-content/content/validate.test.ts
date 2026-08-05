import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validate } from "./validate";

const globPatterns = vi.hoisted((): string[] => []);

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

  it("validates only Nakafa-owned filesystem scopes", async () => {
    await Effect.runPromise(validate());

    expect(globPatterns).toEqual([
      "articles/**/*.mdx",
      "material/lesson/**/*.mdx",
    ]);
  });
});
