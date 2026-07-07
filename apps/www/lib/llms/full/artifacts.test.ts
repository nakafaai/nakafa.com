// @vitest-environment node
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
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
  readSitemapPageDescriptors: () =>
    Effect.succeed([
      { id: "base" },
      {
        id: "content_en_articles_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "articles",
      },
      {
        id: "content_en_material_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "material",
      },
      {
        id: "content_en_tryout_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "tryout",
      },
      {
        id: "content_id_quran_1",
        kind: "content",
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

      if (section === "material") {
        return Effect.succeed([
          createEntry({
            route: "/subjects/chemistry/green-chemistry/definition",
            section: "material",
            title: "Definition",
          }),
          createEntry({
            route: "/subjects/chemistry/blank",
            section: "material",
            title: "Blank Lesson",
          }),
          createEntry({
            markdown: false,
            route: "/subjects/chemistry/web",
            section: "material",
            title: "Web Lesson",
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
        if (
          cleanSlug === "articles/story/missing" ||
          cleanSlug === "subjects/chemistry/blank"
        ) {
          return Effect.succeed(null);
        }
        return Effect.succeed(`${locale}:${cleanSlug}: full markdown`);
      }
    );
  });

  it("builds a compact shard-first entrypoint without embedding documents", async () => {
    const text = await Effect.runPromise(getLlmsFullText());

    expect(text.startsWith("# Nakafa Full Documentation\n\n> ")).toBe(true);
    expect(text).toContain(`Source index: ${BASE_URL}/llms.txt`);
    expect(text).toContain(`Shard manifest: ${BASE_URL}/llms-full/index.json`);
    expect(text).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`);
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
    expect(shardPaths).toContain("llms-full/en/material/page/0.txt");
    expect(shardPaths).toContain("llms-full/id/quran/page/1.txt");
    expect(
      artifacts.shards.find(
        (artifact) => artifact.path === "llms-full/en/articles/page/0.txt"
      )?.text
    ).toContain("en:articles/story/example");
    expect(
      artifacts.shards.find(
        (artifact) => artifact.path === "llms-full/en/material/page/0.txt"
      )?.text
    ).toContain(
      "Nakafa English Material: Page / 0 / Definition Full Documentation"
    );
    const fullShardText = artifacts.shards
      .map((artifact) => artifact.text)
      .join("\n");
    expect(fullShardText).not.toContain(`${BASE_URL}/en/try-out/`);
    expect(manifestData.entrypoint).toBe(`${BASE_URL}/llms-full.txt`);
    expect(manifestData.manifest).toBe(`${BASE_URL}/llms-full/index.json`);
    expect(manifestData.totals.documents).toBe(3);
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      id: "content_en_articles_0",
      kind: "content",
      locale: "en",
      page: 0,
      section: "articles",
    });
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      id: "content_en_material_0",
      kind: "content",
      locale: "en",
      page: 0,
      section: "material",
    });
    expect(mockGetContentPageLlmsEntries).not.toHaveBeenCalledWith(
      expect.objectContaining({
        section: "tryout",
      })
    );
    expect(mockGetContentPageLlmsEntries).toHaveBeenCalledWith({
      id: "content_id_quran_1",
      kind: "content",
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
  markdown = true,
  route,
  section,
  title,
}: {
  locale?: Locale;
  markdown?: boolean;
  route: string;
  section: LlmsEntry["section"];
  title: string;
}): LlmsEntry {
  const segments = route.split("/").filter(Boolean);
  const markdownSuffix = markdown ? ".md" : "";

  return {
    description: "Fixture description",
    href: `${BASE_URL}/${locale}${route}${markdownSuffix}`,
    route,
    section,
    segments,
    title,
  };
}
