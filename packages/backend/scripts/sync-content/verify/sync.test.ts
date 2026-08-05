import { contentCountTables } from "@repo/backend/convex/contentSync/tables";
import { ContentCountsSchema } from "@repo/backend/scripts/sync-content/contract/inspection";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import { verify } from "@repo/backend/scripts/sync-content/verify/sync";
import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const globFilesMock = vi.hoisted(() => vi.fn());

const counts = Schema.decodeUnknownSync(ContentCountsSchema)(
  Object.fromEntries(contentCountTables.map(({ field }) => [field, 0]))
);

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  log: () => undefined,
  logError: () => undefined,
  logSuccess: () => undefined,
}));

vi.mock("@repo/backend/scripts/sync-content/convex/counts", () => ({
  getContentCounts: () =>
    Effect.succeed({
      ...counts,
      articles: 1,
      quranSurahs: 1,
      quranVerses: 1,
    }),
}));

vi.mock("@repo/backend/scripts/sync-content/convex/inspection", () => ({
  getDataIntegrity: () =>
    Effect.succeed({
      articlesWithoutReferences: [],
      sectionsWithoutTopics: [],
      totalArticles: 1,
      totalSections: 0,
    }),
}));

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  globFiles: globFilesMock,
}));

vi.mock("@repo/backend/scripts/sync-content/verify/graph", () => ({
  verifyGraphIdentity: () => Effect.succeed(true),
}));

vi.mock("@repo/backend/scripts/sync-content/verify/quran", () => ({
  verifyQuranRuntime: () => Effect.succeed(true),
}));

vi.mock("@repo/backend/scripts/sync-content/verify/summary", () => ({
  logVerifySuccess: () => undefined,
}));

vi.mock("@repo/contents/_lib/quran", () => ({
  readQuranMetadata: () => Effect.succeed([{ numberOfVerses: 1 }]),
}));

vi.mock("@repo/contents/_types/material/registry", () => ({
  listLessonMaterialSources: () => [],
  listLessonRows: () => [],
}));

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

describe("content verification", () => {
  beforeEach(() => {
    globFilesMock.mockReset();
    globFilesMock.mockImplementation((pattern: string) =>
      Effect.succeed(pattern === "articles/**/*.mdx" ? ["articles/id.mdx"] : [])
    );
  });

  it("verifies every Nakafa-owned filesystem source", async () => {
    await expect(Effect.runPromise(verify(config))).resolves.toBeUndefined();

    expect(globFilesMock.mock.calls).toEqual([
      ["articles/**/*.mdx"],
      ["material/lesson/**/*.mdx"],
      ["articles/**/ref.ts"],
    ]);
  });
});
