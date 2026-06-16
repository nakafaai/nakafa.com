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
const BLOCKED_OUTCOME_ROWS_FILE = join(
  TYPES_ROOT,
  "outcome",
  ["source", "ts"].join(".")
);
const BLOCKED_PLAN_SOURCE_DIRECTORY = join(TYPES_ROOT, "plan");
const REMOVED_DATA_DIRECTORY_NAME = ["_", "data"].join("");
const MATERIAL_SUBJECT_SOURCE_ROOT = join(
  TYPES_ROOT,
  "material",
  "source",
  "subject"
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

  if (!existsSync(directory)) {
    return matches;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      matches.push(...findRouteLocalMaterialFiles(entryPath));
      continue;
    }

    if (
      entryPath.includes(`/${REMOVED_DATA_DIRECTORY_NAME}/`) &&
      BLOCKED_MATERIAL_BASENAMES.has(entry.name)
    ) {
      matches.push(entryPath);
    }
  }

  return matches;
}

describe("source registry adapter", () => {
  it("adapts current material source routes into graph records", () => {
    const record = createSourceRegistryRecord({
      locale: "id",
      route:
        "/material/lesson/chemistry/atomic-structure/electron-configuration/",
      sourcePath:
        "material/lesson/chemistry/atomic-structure/electron-configuration/id.mdx",
    });

    expect(record).toMatchObject({
      assetId:
        "asset:id:material:lesson:chemistry:material-section:chemistry:atomic-structure:electron-configuration",
      kind: "curriculum-lesson",
      lensId: "lens:material:lesson:chemistry",
      publicRoute:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
      sourcePath:
        "material/lesson/chemistry/atomic-structure/electron-configuration/id.mdx",
      sourceRoot: "material",
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
      sourcePath: "quran/source.ts",
    });
    const exercise = createSourceRegistryRecord({
      locale: "en",
      route: "material/practice/assessment/snbt/general-reasoning/try-out-2026",
      sourcePath: "curriculum/unrelated-shape/file.mdx",
    });

    expect(quran?.sourceRoot).toBe("quran");
    expect(exercise?.sourceRoot).toBe("material");
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
    expect(normalizeSourcePath("//curriculum//high-school/10//id.mdx/")).toBe(
      "curriculum/high-school/10/id.mdx"
    );
  });

  it("blocks JSON source registries under contents type modules", () => {
    expect(findSourceJsonFiles(TYPES_ROOT)).toEqual([]);
  });

  it("blocks standalone concept source rows", () => {
    expect(existsSync(BLOCKED_CONCEPT_ROWS_FILE)).toBe(false);
  });

  it("blocks mixed outcome source rows", () => {
    expect(existsSync(BLOCKED_OUTCOME_ROWS_FILE)).toBe(false);
  });

  it("blocks the old plan source tree from returning as curriculum truth", () => {
    expect(existsSync(BLOCKED_PLAN_SOURCE_DIRECTORY)).toBe(false);
  });

  it("blocks route-shaped material lesson source folders from returning", () => {
    expect(existsSync(join(MATERIAL_SUBJECT_SOURCE_ROOT, "high-school"))).toBe(
      false
    );
    expect(
      existsSync(join(MATERIAL_SUBJECT_SOURCE_ROOT, "middle-school"))
    ).toBe(false);
    expect(existsSync(join(MATERIAL_SUBJECT_SOURCE_ROOT, "university"))).toBe(
      false
    );
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
