import { DateOnlySchema } from "@repo/contents/_shared/date";
import {
  type AssetSourceInput,
  createAssetRecord,
  createAssetRegistry,
  getCanonicalAssetKey,
} from "@repo/contents/_types/asset/projection";
import { AssetRegistry } from "@repo/contents/_types/asset/registry";
import {
  AssetGraphIdSchema,
  AssetRecordSchema,
  AssetSourcePathSchema,
  CanonicalAssetKeySchema,
  LocalizedAssetIdSchema,
} from "@repo/contents/_types/asset/schema";
import { ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("asset registry", () => {
  it("groups localized source routes under one canonical asset key", () => {
    const rows = createAssetRegistry([
      subjectSource("en"),
      subjectSource("id"),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      conceptIds: ["concept:material:lesson:chemistry:atomic-structure"],
      key: "asset:material:lesson:chemistry:material-section:chemistry:atomic-structure:electron-configuration",
      kind: "curriculum-lesson",
      lensId: "lens:material:lesson:chemistry",
      sourceRoot: "material",
    });
    expect(rows[0]?.locales.map((source) => source.locale)).toEqual([
      "en",
      "id",
    ]);
    expect(rows[0]?.locales[0]?.localizedAssetId).toContain("asset:en:");
    expect(rows[0]?.key).not.toContain("asset:en:");
    expect(rows[0]?.key).not.toContain("asset:id:");
  });

  it("keeps date-only metadata at the asset source boundary", () => {
    const row = createAssetRecord({
      ...subjectSource("id"),
      date: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
    });

    expect(row?.locales[0]?.date).toBe("2026-06-15");
    expect(
      Schema.decodeUnknownEither(AssetRecordSchema)({
        ...row,
        locales: [{ ...row?.locales[0], date: "2026/06/15" }],
      })._tag
    ).toBe("Left");
  });

  it("deduplicates repeated localized source inputs", () => {
    const rows = createAssetRegistry([
      subjectSource("id"),
      subjectSource("id"),
      subjectSource("en"),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.locales).toHaveLength(2);
  });

  it("sorts canonical asset records deterministically", () => {
    const rows = createAssetRegistry([
      subjectSource("id"),
      mechanicsSource("id"),
    ]);

    expect(rows.map((row) => row.key)).toEqual([
      "asset:material:lesson:chemistry:material-section:chemistry:atomic-structure:electron-configuration",
      "asset:material:lesson:physics:material-section:physics:mechanics:newton-law",
    ]);
  });

  it("ignores unsupported source routes instead of inventing asset identity", () => {
    const rows = createAssetRegistry([
      {
        locale: "id",
        route: "school/internal/planner",
        sourcePath: "school/internal/planner/id.mdx",
      },
    ]);

    expect(rows).toEqual([]);
  });

  it("derives canonical asset keys from graph alignment identity", () => {
    expect(
      getCanonicalAssetKey(
        "alignment:tryout:indonesia:snbt:tryout-set:indonesia:snbt:2027:set-1"
      )
    ).toBe("asset:tryout:indonesia:snbt:tryout-set:indonesia:snbt:2027:set-1");
    expect(Schema.is(CanonicalAssetKeySchema)("asset:bad/key")).toBe(false);
  });

  it("exposes a small registry facade without owning source rows", () => {
    const row = AssetRegistry.createRecord(subjectSource("id"));

    expect(row?.key).toBe(
      "asset:material:lesson:chemistry:material-section:chemistry:atomic-structure:electron-configuration"
    );
    expect(AssetRegistry.createRegistry([subjectSource("id")])).toHaveLength(1);
  });

  it("reports schema-specific asset source errors", () => {
    expect(formatError(AssetGraphIdSchema, "asset:bad/path")).toContain(
      "Invalid graph ID."
    );
    expect(formatError(CanonicalAssetKeySchema, "concept:math")).toContain(
      "Invalid canonical asset key."
    );
    expect(formatError(LocalizedAssetIdSchema, "concept:math")).toContain(
      "Invalid localized asset ID."
    );
    expect(
      formatError(AssetSourcePathSchema, "../curriculum/id.mdx")
    ).toContain("Invalid asset source path.");
  });
});

/** Create a subject asset source fixture for one locale. */
function subjectSource(locale: "en" | "id"): AssetSourceInput {
  return {
    locale,
    route: "material/lesson/chemistry/atomic-structure/electron-configuration",
    sourcePath: `material/lesson/chemistry/atomic-structure/electron-configuration/${locale}.mdx`,
  };
}

/** Create a mechanics asset source fixture for one locale. */
function mechanicsSource(locale: "en" | "id"): AssetSourceInput {
  return {
    locale,
    route: "material/lesson/physics/mechanics/newton-law",
    sourcePath: `material/lesson/physics/mechanics/newton-law/${locale}.mdx`,
  };
}

/** Format a schema decoding failure for readable fixture assertions. */
function formatError<Decoded, Encoded>(
  schema: Schema.Schema<Decoded, Encoded, never>,
  value: unknown
) {
  const result = Schema.decodeUnknownEither(schema)(value);

  if (result._tag === "Right") {
    return "";
  }

  return ParseResult.TreeFormatter.formatErrorSync(result.left);
}
