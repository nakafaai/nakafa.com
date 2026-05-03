import { describe, expect, it } from "vitest";
import {
  buildFullManifest,
  buildRootFullText,
  buildShard,
  buildTextArtifact,
  flattenShards,
} from "@/lib/llms/full/shards";
import type { LlmsFullDocument } from "@/lib/llms/full/types";

const subjectDefinitionText =
  "Markdown URL: subject-definition\n\nDefinition content";
const subjectAtomsText = "Markdown URL: subject-atoms\n\nAtoms content";
const quranIndexText = "Markdown URL: quran\n\nQuran index content";
const quranSurahText = "Markdown URL: quran-1\n\nAl-Fatihah content";

const documents = [
  {
    bytes: Buffer.byteLength(subjectDefinitionText, "utf8"),
    locale: "en",
    section: "subject",
    segments: [
      "subject",
      "high-school",
      "10",
      "chemistry",
      "green-chemistry",
      "definition",
    ],
    text: subjectDefinitionText,
  },
  {
    bytes: Buffer.byteLength(subjectAtomsText, "utf8"),
    locale: "en",
    section: "subject",
    segments: ["subject", "high-school", "10", "chemistry", "atoms"],
    text: subjectAtomsText,
  },
  {
    bytes: Buffer.byteLength(quranIndexText, "utf8"),
    locale: "en",
    section: "quran",
    segments: ["quran"],
    text: quranIndexText,
  },
  {
    bytes: Buffer.byteLength(quranSurahText, "utf8"),
    locale: "en",
    section: "quran",
    segments: ["quran", "1"],
    text: quranSurahText,
  },
] satisfies LlmsFullDocument[];

describe("llms full shards", () => {
  it("builds a compact root entrypoint without inline page bodies", () => {
    const localeShard = buildShard({
      documents,
      locale: "en",
      prefixParts: [],
      shardTargetBytes: 50,
    });
    const text = buildRootFullText({
      documents,
      localeShards: [localeShard],
    });

    expect(text.startsWith("# Nakafa Full Documentation\n\n> ")).toBe(true);
    expect(text).toContain("https://nakafa.com/llms.txt");
    expect(text).toContain("https://nakafa.com/llms-full/index.json");
    expect(text).toContain("https://nakafa.com/sitemap.xml");
    expect(text).toContain("- Documents: 4");
    expect(text).toContain("Nakafa English Full Documentation");
    expect(text).not.toContain("Markdown URL:");
    expect(text).not.toContain("Definition content");
  });

  it("recursively splits oversized scopes by real route segments", () => {
    const shard = buildShard({
      documents,
      locale: "en",
      prefixParts: [],
      shardTargetBytes: 1,
    });
    const paths = flattenShards([shard]).map((item) => item.path);

    expect(paths).toContain("llms-full/en/subject/high-school/10.txt");
    expect(paths).toContain(
      "llms-full/en/subject/high-school/10/chemistry.txt"
    );
    expect(paths).toContain(
      "llms-full/en/subject/high-school/10/chemistry/green-chemistry/definition.txt"
    );
    expect(paths).toContain("llms-full/en/quran.txt");
    expect(paths).toContain("llms-full/en/quran/1.txt");

    const quranShard = flattenShards([shard]).find(
      (item) => item.path === "llms-full/en/quran.txt"
    );

    expect(quranShard?.text).toContain("## Direct Documents");
    expect(quranShard?.text).toContain("Quran index content");
  });

  it("preserves oversized leaf content and reports it in the manifest", () => {
    const shard = buildShard({
      documents: documents.slice(0, 1),
      locale: "en",
      prefixParts: [],
      shardTargetBytes: 1,
    });
    const root = buildTextArtifact(
      "llms-full.txt",
      buildRootFullText({
        documents: documents.slice(0, 1),
        localeShards: [shard],
      })
    );
    const manifest = buildFullManifest({
      documents: documents.slice(0, 1),
      root,
      shards: [shard],
    });
    const leaf = flattenShards([shard]).find((item) =>
      item.path.endsWith("definition.txt")
    );

    expect(leaf?.oversized).toBe(true);
    expect(leaf?.text).toContain("Definition content");
    expect(manifest.oversized).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: leaf?.path,
        }),
      ])
    );
  });
});
