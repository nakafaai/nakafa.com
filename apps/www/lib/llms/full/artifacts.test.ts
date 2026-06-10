// @vitest-environment node
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmsEntry } from "@/lib/llms/entries";
import {
  getLlmsFullArtifacts,
  getLlmsFullText,
} from "@/lib/llms/full/artifacts";

const mockGetContentPageLlmsEntries = vi.hoisted(() => vi.fn());
const mockGetLlmsSourceMarkdownText = vi.hoisted(() => vi.fn());

vi.mock("node:os", () => ({
  availableParallelism: () => 2,
  default: {
    availableParallelism: () => 2,
  },
}));

vi.mock("@/lib/sitemap/routes", () => ({
  getSitemapPageDescriptorsEffect: () =>
    Effect.succeed([
      { id: "base" },
      {
        id: "content_en_articles_0",
        locale: "en",
        page: 0,
        section: "articles",
      },
      {
        id: "content_en_exercises_0",
        locale: "en",
        page: 0,
        section: "exercises",
      },
      {
        id: "content_id_quran_1",
        locale: "id",
        page: 1,
        section: "quran",
      },
    ]),
}));

vi.mock("@/lib/llms/content", () => ({
  getLlmsSourceMarkdownText: mockGetLlmsSourceMarkdownText,
}));

vi.mock("@/lib/llms/entries", () => ({
  getContentPageLlmsEntries: mockGetContentPageLlmsEntries,
}));

describe("llms full document", () => {
  beforeEach(() => {
    mockGetContentPageLlmsEntries.mockReset();
    mockGetLlmsSourceMarkdownText.mockReset();
    mockGetContentPageLlmsEntries.mockImplementation(({ section }) => {
      if (section === "articles") {
        return Effect.succeed([
          createEntry({
            route: "/articles/story/example",
            section: "articles",
            title: "Example Article",
          }),
          createEntry({
            route: "/articles/story/missing",
            section: "articles",
            title: "Missing",
          }),
        ]);
      }

      if (section === "exercises") {
        return Effect.succeed([
          createEntry({
            route:
              "/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1",
            section: "exercises",
            title: "Set 1",
          }),
          createEntry({
            route:
              "/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9",
            section: "exercises",
            title: "Exercise 9",
          }),
        ]);
      }

      return Effect.succeed([
        createEntry({
          locale: "id",
          route: "/quran/1",
          section: "quran",
          title: "Al-Fatihah",
        }),
      ]);
    });
    mockGetLlmsSourceMarkdownText.mockImplementation(
      ({ cleanSlug, locale }) => {
        if (cleanSlug === "articles/story/missing") {
          return Effect.succeed(null);
        }

        return Effect.succeed(`${locale}:${cleanSlug}: full markdown`);
      }
    );
  });

  it("builds a compact shard-first entrypoint without embedding documents", async () => {
    const text = await Effect.runPromise(getLlmsFullText());

    expect(text.startsWith("# Nakafa Full Documentation\n\n> ")).toBe(true);
    expect(text).toContain("Source index: https://nakafa.com/llms.txt");
    expect(text).toContain(
      "Shard manifest: https://nakafa.com/llms-full/index.json"
    );
    expect(text).toContain("Sitemap: https://nakafa.com/sitemap.xml");
    expect(text).toContain("## How To Use");
    expect(text).toContain("## Corpus Summary");
    expect(text).toContain("## Shards");
    expect(text).toContain("- Documents: 3");
    expect(text).toContain(
      "Nakafa English Articles: Page / 0 Full Documentation"
    );
    expect(text).toContain(
      "Nakafa Indonesian Quran: Page / 1 Full Documentation"
    );
    expect(text).not.toContain("Markdown URL:");
    expect(text).not.toContain("full markdown");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("builds manifest and shard files from bounded route pages", async () => {
    const artifacts = await Effect.runPromise(
      getLlmsFullArtifacts({ shardTargetBytes: 1 })
    );
    const { manifestData } = artifacts;
    const shardPaths = artifacts.shards.map((artifact) => artifact.path);

    expect(artifacts.root.path).toBe("llms-full.txt");
    expect(artifacts.manifest.path).toBe("llms-full/index.json");
    expect(shardPaths).toContain("llms-full/en/articles/page/0.txt");
    expect(shardPaths).toContain("llms-full/en/exercises/page/0.txt");
    expect(shardPaths).toContain("llms-full/id/quran/page/1.txt");
    expect(
      artifacts.shards.find(
        (artifact) => artifact.path === "llms-full/en/articles/page/0.txt"
      )?.text
    ).toContain("en:articles/story/example");
    expect(
      artifacts.shards.find(
        (artifact) => artifact.path === "llms-full/en/exercises/page/0.txt"
      )?.text
    ).not.toContain("set-1/9: full markdown");
    expect(manifestData.entrypoint).toBe("https://nakafa.com/llms-full.txt");
    expect(manifestData.manifest).toBe(
      "https://nakafa.com/llms-full/index.json"
    );
    expect(manifestData.totals.documents).toBe(3);
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      id: "content_en_articles_0",
      locale: "en",
      page: 0,
      section: "articles",
    });
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      id: "content_en_exercises_0",
      locale: "en",
      page: 0,
      section: "exercises",
    });
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      id: "content_id_quran_1",
      locale: "id",
      page: 1,
      section: "quran",
    });

    for (const artifact of artifacts.shards) {
      const shard = manifestData.shards.find(
        (item) => item.path === artifact.path
      );

      expect(shard?.bytes).toBe(Buffer.byteLength(artifact.text, "utf8"));
    }
  });

  it("omits empty route pages from generated artifacts", async () => {
    mockGetContentPageLlmsEntries.mockReturnValue(Effect.succeed([]));

    const text = await Effect.runPromise(getLlmsFullText());

    expect(text).toContain("- Documents: 0");
    expect(text).not.toContain("Markdown URL:");
  });
});

/** Builds one llms entry fixture for a bounded content page. */
function createEntry({
  locale = "en",
  route,
  section,
  title,
}: {
  locale?: "en" | "id";
  route: string;
  section: "articles" | "exercises" | "quran";
  title: string;
}): LlmsEntry {
  const segments = route.split("/").filter(Boolean);

  return {
    description: "Fixture description",
    href: `https://nakafa.com/${locale}${route}.md`,
    route,
    section,
    segments,
    title,
  };
}
