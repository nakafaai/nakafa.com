import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLlmsFullArtifacts,
  getLlmsFullText,
} from "@/lib/llms/full/artifacts";

const mockGetLlmsSourceMarkdownText = vi.hoisted(() => vi.fn());
const mockGetLocalizedLlmsEntries = vi.hoisted(() => vi.fn());

vi.mock("node:os", () => ({
  availableParallelism: () => 2,
  default: {
    availableParallelism: () => 2,
  },
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    locales: ["en", "id"],
  },
}));

vi.mock("@/lib/llms/content", () => ({
  getLlmsSourceMarkdownText: mockGetLlmsSourceMarkdownText,
}));

vi.mock("@/lib/llms/entries", () => ({
  getLocalizedLlmsEntries: mockGetLocalizedLlmsEntries,
}));

const localizedEntries = [
  {
    description: "Article description",
    href: "https://nakafa.com/en/articles/story/example.md",
    route: "/articles/story/example",
    section: "articles",
    segments: ["articles", "story", "example"],
    title: "Example Article",
  },
  {
    description: "Subject description",
    href: "https://nakafa.com/en/subject/high-school/10/chemistry.md",
    route: "/subject/high-school/10/chemistry",
    section: "subject",
    segments: ["subject", "high-school", "10", "chemistry"],
    title: "Chemistry",
  },
  {
    description: "Exercise description",
    href: "https://nakafa.com/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1.md",
    route: "/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1",
    section: "exercises",
    segments: [
      "exercises",
      "high-school",
      "snbt",
      "general-knowledge",
      "try-out",
      "2026",
      "set-1",
    ],
    title: "Set 1",
  },
  {
    description: "Question description",
    href: "https://nakafa.com/en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9.md",
    route: "/exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9",
    section: "exercises",
    segments: [
      "exercises",
      "high-school",
      "snbt",
      "general-knowledge",
      "try-out",
      "2026",
      "set-1",
      "9",
    ],
    title: "Exercise 9",
  },
  {
    description: "Quran description",
    href: "https://nakafa.com/en/quran.md",
    route: "/quran",
    section: "quran",
    segments: ["quran"],
    title: "Quran",
  },
  {
    description: "Quran surah description",
    href: "https://nakafa.com/en/quran/1.md",
    route: "/quran/1",
    section: "quran",
    segments: ["quran", "1"],
    title: "Al-Fatihah",
  },
  {
    description: "Site description",
    href: "https://nakafa.com/en/about",
    route: "/about",
    section: "site",
    segments: ["site", "about"],
    title: "About",
  },
  {
    description: "Missing description",
    href: "https://nakafa.com/en/articles/story/missing.md",
    route: "/articles/story/missing",
    section: "articles",
    segments: ["articles", "story", "missing"],
    title: "Missing",
  },
];

describe("llms full document", () => {
  beforeEach(() => {
    mockGetLocalizedLlmsEntries.mockReset();
    mockGetLlmsSourceMarkdownText.mockReset();

    mockGetLocalizedLlmsEntries.mockResolvedValue(localizedEntries);
    mockGetLlmsSourceMarkdownText.mockImplementation(
      ({ cleanSlug, locale }) => {
        if (cleanSlug === "articles/story/missing") {
          return Promise.resolve(null);
        }

        return Promise.resolve(`${locale}:${cleanSlug}: full markdown`);
      }
    );
  });

  it("builds a complete locale-grouped markdown snapshot from sitemap entries", async () => {
    const text = await Effect.runPromise(getLlmsFullText());

    expect(text.startsWith("# Nakafa Full Documentation\n\n> ")).toBe(true);
    expect(text).toContain("Source index: https://nakafa.com/llms.txt");
    expect(text).toContain(
      "Shard manifest: https://nakafa.com/llms-full/index.json"
    );
    expect(text).toContain("## Shard Map");
    expect(text).toContain("## English Documentation");
    expect(text).toContain("## Indonesian Documentation");
    expect(text).toContain(
      "Markdown URL: https://nakafa.com/en/articles/story/example.md"
    );
    expect(text).toContain("en:articles/story/example: full markdown");
    expect(text).toContain(
      "en:subject/high-school/10/chemistry: full markdown"
    );
    expect(text).toContain(
      "en:exercises/high-school/snbt/general-knowledge/try-out/2026/set-1: full markdown"
    );
    expect(text).toContain("en:quran/1: full markdown");
    expect(text).toContain("en:quran: full markdown");
    expect(text).toContain("id:quran/1: full markdown");
    expect(text).not.toContain("Markdown URL: https://nakafa.com/en/about");
    expect(text).not.toContain("articles/story/missing: full markdown");
    expect(text).not.toContain(
      "exercises/high-school/snbt/general-knowledge/try-out/2026/set-1/9: full markdown"
    );
    expect(text.endsWith("\n")).toBe(true);
  });

  it("builds a shard manifest and source-derived shard files without truncating documents", async () => {
    const artifacts = await Effect.runPromise(
      getLlmsFullArtifacts({ shardTargetBytes: 1 })
    );
    const { manifestData } = artifacts;
    const shardPaths = artifacts.shards.map((artifact) => artifact.path);

    expect(artifacts.root.path).toBe("llms-full.txt");
    expect(artifacts.manifest.path).toBe("llms-full/index.json");
    expect(artifacts.root.text).toContain(
      "https://nakafa.com/llms-full/index.json"
    );
    expect(shardPaths).toContain("llms-full/en.txt");
    expect(shardPaths).toContain("llms-full/en/articles.txt");
    expect(shardPaths).toContain("llms-full/en/articles/story.txt");
    expect(shardPaths).toContain("llms-full/en/articles/story/example.txt");
    expect(shardPaths).toContain("llms-full/en/subject/high-school.txt");
    expect(shardPaths).toContain("llms-full/en/quran/1.txt");

    const articleShard = artifacts.shards.find(
      (artifact) => artifact.path === "llms-full/en/articles/story/example.txt"
    );
    const localeShard = artifacts.shards.find(
      (artifact) => artifact.path === "llms-full/en.txt"
    );

    expect(articleShard?.text).toContain("en:articles/story/example");
    expect(articleShard?.text).toContain(
      "Markdown URL: https://nakafa.com/en/articles/story/example.md"
    );
    expect(localeShard?.text).toContain("## Shards");
    expect(localeShard?.text).not.toContain("en:articles/story/example");
    expect(
      artifacts.shards.find(
        (artifact) => artifact.path === "llms-full/en/quran.txt"
      )?.text
    ).toContain("## Direct Documents");
    expect(manifestData.full).toBe("https://nakafa.com/llms-full.txt");
    expect(manifestData.manifest).toBe(
      "https://nakafa.com/llms-full/index.json"
    );
    expect(manifestData.totals.documents).toBe(10);
    expect(manifestData.shards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "llms-full/en/articles/story/example.txt",
          oversized: true,
        }),
      ])
    );

    for (const artifact of artifacts.shards) {
      const shard = manifestData.shards.find(
        (item) => item.path === artifact.path
      );

      expect(shard?.bytes).toBe(Buffer.byteLength(artifact.text, "utf8"));
    }
  });

  it("omits locale sections when no markdown documents are available", async () => {
    mockGetLocalizedLlmsEntries.mockResolvedValue([
      {
        description: "Site description",
        href: "https://nakafa.com/en/about",
        route: "/about",
        section: "site",
        segments: ["site", "about"],
        title: "About",
      },
    ]);

    const text = await Effect.runPromise(getLlmsFullText());

    expect(text).not.toContain("## English Documentation");
    expect(text).not.toContain("## Indonesian Documentation");
  });
});
