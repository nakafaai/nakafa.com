import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getSourceRegistryRootForKind } from "@repo/contents/_types/graph/schema";
import {
  createSourceRegistryRecord,
  normalizeSourcePath,
} from "@repo/contents/_types/source-registry";
import { describe, expect, it } from "vitest";

const TYPES_ROOT = join(process.cwd(), "_types");
const CONTENTS_ROOT = process.cwd();
const BLOCKED_CONCEPT_ROWS_FILE = join(
  TYPES_ROOT,
  "concept",
  ["source", "ts"].join(".")
);
const BLOCKED_SOURCE_BASENAME = ["source", "json"].join(".");
const BLOCKED_MATERIAL_BASENAMES = new Set([
  "en-material.ts",
  "id-material.ts",
  "path.ts",
]);

function findSourceJsonFiles(directory: string): string[] {
  const matches: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      matches.push(...findSourceJsonFiles(entryPath));
      continue;
    }

    if (entry.name === BLOCKED_SOURCE_BASENAME) {
      matches.push(entryPath);
    }
  }

  return matches;
}

function findRouteLocalMaterialFiles(directory: string): string[] {
  const matches: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      matches.push(...findRouteLocalMaterialFiles(entryPath));
      continue;
    }

    if (
      entryPath.includes("/_data/") &&
      BLOCKED_MATERIAL_BASENAMES.has(entry.name)
    ) {
      matches.push(entryPath);
    }
  }

  return matches;
}

describe("source registry adapter", () => {
  it("adapts current subject source routes into graph records", () => {
    const record = createSourceRegistryRecord({
      locale: "id",
      route:
        "/subject/high-school/10/chemistry/atomic-structure/electron-configuration/",
      sourcePath:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration/id.mdx",
    });

    expect(record).toMatchObject({
      assetId:
        "asset:id:subject:high-school:10:chemistry:subject-section:chemistry:atomic-structure:electron-configuration",
      kind: "subject-section",
      lensId: "lens:subject:high-school:10:chemistry",
      publicRoute:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration",
      sourcePath:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration/id.mdx",
      sourceRoot: "subject",
    });
  });

  it("keeps source paths as provenance instead of product identity", () => {
    const record = createSourceRegistryRecord({
      locale: "en",
      route: "articles/politics/democracy",
      sourcePath: "/articles/politics/democracy/en.mdx",
    });

    expect(record?.sourcePath).toBe("articles/politics/democracy/en.mdx");
    expect(record?.assetId).toBe(
      "asset:en:article:politics:article:politics:democracy"
    );
  });

  it("derives registry roots from graph kind instead of source paths", () => {
    const quran = createSourceRegistryRecord({
      locale: "id",
      route: "quran/1",
      sourcePath: "_data/quran.ts",
    });
    const exercise = createSourceRegistryRecord({
      locale: "en",
      route: "exercises/high-school/snbt/general-reasoning/try-out/2026",
      sourcePath: "subject/unrelated-shape/file.mdx",
    });

    expect(quran?.sourceRoot).toBe("quran");
    expect(exercise?.sourceRoot).toBe("exercises");
    expect(exercise?.sourceRoot).toBe(
      getSourceRegistryRootForKind("exercise-group")
    );
  });

  it("rejects unsupported route projections", () => {
    expect(
      createSourceRegistryRecord({
        locale: "id",
        route: "schools/internal/planner",
        sourcePath: "schools/internal/planner/id.mdx",
      })
    ).toBeNull();
  });

  it("normalizes noisy source path provenance", () => {
    expect(normalizeSourcePath("//subject//high-school/10//id.mdx/")).toBe(
      "subject/high-school/10/id.mdx"
    );
  });

  it("blocks JSON source registries under contents type modules", () => {
    expect(findSourceJsonFiles(TYPES_ROOT)).toEqual([]);
  });

  it("blocks standalone concept source rows", () => {
    expect(existsSync(BLOCKED_CONCEPT_ROWS_FILE)).toBe(false);
  });

  it("blocks route-local subject and exercise material source files", () => {
    expect(findRouteLocalMaterialFiles(join(CONTENTS_ROOT, "subject"))).toEqual(
      []
    );
    expect(
      findRouteLocalMaterialFiles(join(CONTENTS_ROOT, "exercises"))
    ).toEqual([]);
  });
});
