// @vitest-environment node
import { describe, expect, it } from "vitest";
import { BASE_URL } from "@/lib/llms/constants";
import {
  buildFullManifest,
  buildRootFullText,
  buildShard,
  buildTextArtifact,
  flattenShards,
} from "@/lib/llms/full/shards";
import type { LlmsFullDocument } from "@/lib/llms/full/types";

const materialDefinitionText =
  "Markdown URL: material-definition\n\nDefinition content";
const materialAtomsText = "Markdown URL: material-atoms\n\nAtoms content";
const quranIndexText = "Markdown URL: quran\n\nQuran index content";
const quranSurahText = "Markdown URL: quran-1\n\nAl-Fatihah content";

const documents = [
  {
    bytes: Buffer.byteLength(materialDefinitionText, "utf8"),
    locale: "en",
    section: "material",
    segments: [
      "material",
      "lesson",
      "chemistry",
      "green-chemistry",
      "definition",
    ],
    text: materialDefinitionText,
  },
  {
    bytes: Buffer.byteLength(materialAtomsText, "utf8"),
    locale: "en",
    section: "material",
    segments: ["material", "lesson", "chemistry", "atoms"],
    text: materialAtomsText,
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
      shards: [localeShard],
    });

    expect(text.startsWith("# Nakafa Full Documentation\n\n> ")).toBe(true);
    expect(text).toContain(`${BASE_URL}/llms.txt`);
    expect(text).toContain(`${BASE_URL}/llms-full/index.json`);
    expect(text).toContain(`${BASE_URL}/sitemap.xml`);
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

    expect(paths).toContain("llms-full/en/material/lesson/chemistry.txt");
    expect(paths).toContain(
      "llms-full/en/material/lesson/chemistry/green-chemistry/definition.txt"
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
        shards: [shard],
      })
    );
    const manifest = buildFullManifest({
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
