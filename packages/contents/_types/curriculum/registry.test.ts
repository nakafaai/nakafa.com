import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getProgramKeysForMaterialRoute } from "@repo/contents/_types/curriculum/projection";
import {
  getCurriculumSourceIssues,
  listCurricula,
} from "@repo/contents/_types/curriculum/registry";
import {
  CurriculumSourceSchema,
  defineCurriculum,
} from "@repo/contents/_types/curriculum/schema";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

const CURRICULUM_SOURCE_ROOT = join(process.cwd(), "curriculum");
const PUBLIC_ROUTE_FOLDER_PATTERN = /subject\/|exercises\//;

function readCurriculumSourceFiles(directory: string): string[] {
  const sources: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      sources.push(...readCurriculumSourceFiles(entryPath));
      continue;
    }

    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      sources.push(readFileSync(entryPath, "utf8"));
    }
  }

  return sources;
}

describe("curriculum registry", () => {
  it("maps curriculum nodes to existing reusable material keys", () => {
    expect(getCurriculumSourceIssues()).toEqual([]);
    expect(
      getProgramKeysForMaterialRoute({
        route: "material/lesson/mathematics/statistics-foundations",
      })
    ).toEqual(["cambridge-igcse", "id-kurikulum-merdeka"]);
  });

  it("keeps material identity independent from source folder shape", () => {
    const curricula = listCurricula();
    const merdeka = curricula.find(
      (curriculum) => curriculum.programKey === "id-kurikulum-merdeka"
    );

    expect(merdeka?.nodes.some((node) => node.key === "class-10")).toBe(true);
    expect(
      JSON.stringify(merdeka?.nodes).includes(
        "curriculum/high-school/10/mathematics"
      )
    ).toBe(false);
  });

  it("keeps curriculum sources free of public route folder paths", () => {
    const routePathSources = readCurriculumSourceFiles(
      CURRICULUM_SOURCE_ROOT
    ).filter((source) => PUBLIC_ROUTE_FOLDER_PATTERN.test(source));

    expect(routePathSources).toEqual([]);
  });

  it("keeps each real curriculum behind a folder-owned interface", () => {
    const curricula = listCurricula();

    expect(curricula.map((curriculum) => curriculum.programKey)).toEqual([
      "id-kurikulum-merdeka",
      "cambridge-igcse",
      "us-common-core-ngss",
    ]);
    expect(
      getProgramKeysForMaterialRoute({
        route: "material/lesson/mathematics/quadratic-function",
      })
    ).toEqual(["cambridge-igcse", "id-kurikulum-merdeka"]);
  });

  it("keeps planned US standards visible without inventing material coverage", () => {
    const curricula = listCurricula();
    const usStandards = curricula.find(
      (curriculum) => curriculum.programKey === "us-common-core-ngss"
    );

    expect(usStandards?.nodes.length).toBeGreaterThan(0);
    expect(usStandards?.nodes.flatMap((node) => node.materialKeys)).toEqual([]);
    expect(
      getProgramKeysForMaterialRoute({
        route: "material/lesson/physics/kinematics",
      })
    ).not.toContain("us-common-core-ngss");
  });

  it("returns no programs for routes outside the material registry", () => {
    expect(
      getProgramKeysForMaterialRoute({
        route: "curriculum/not-found",
      })
    ).toEqual([]);
  });

  it("skips curricula that do not reference the matched material", () => {
    const unrelated = defineCurriculum({
      programKey: "fixture-program",
      nodes: [
        {
          key: "target",
          level: "topic",
          materialKeys: ["lesson.biology.biodiversity"],
          order: 1,
          translations: {
            en: { title: "Target" },
            id: { title: "Target" },
          },
        },
      ],
    });

    expect(
      getProgramKeysForMaterialRoute({
        curricula: [unrelated],
        route: "material/lesson/mathematics/statistics-foundations",
      })
    ).toEqual([]);
  });

  it("reports unknown material references", () => {
    const invalid = defineCurriculum({
      programKey: "fixture-program",
      nodes: [
        {
          key: "parent",
          level: "unit",
          materialKeys: [],
          order: 1,
          translations: {
            en: { title: "Parent" },
            id: { title: "Parent" },
          },
        },
        {
          key: "target",
          level: "topic",
          materialKeys: ["missing.material"],
          order: 2,
          parentKey: "parent",
          translations: {
            en: { title: "Target" },
            id: { title: "Target" },
          },
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Unknown material key missing.material in fixture-program:target",
    ]);
  });

  it("reports defensive duplicate and parent issues for decoded source data", () => {
    const decodeCurriculumSource = Schema.decodeUnknownSync(
      CurriculumSourceSchema
    );
    const invalid = decodeCurriculumSource({
      programKey: "fixture-program",
      nodes: [
        {
          key: "target",
          level: "topic",
          materialKeys: [],
          order: 1,
          translations: {
            en: { title: "Target" },
            id: { title: "Target" },
          },
        },
        {
          key: "target",
          level: "topic",
          materialKeys: [],
          order: 2,
          parentKey: "missing-parent",
          translations: {
            en: { title: "Target Again" },
            id: { title: "Target Again" },
          },
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Duplicate curriculum node target in fixture-program",
      "Unknown parent node missing-parent in fixture-program:target",
    ]);
  });

  it("fails fast for duplicate node keys and broken parent links", () => {
    expect(() =>
      defineCurriculum({
        programKey: "fixture-program",
        nodes: [
          {
            key: "target",
            level: "topic",
            materialKeys: [],
            order: 1,
            translations: {
              en: { title: "Target" },
              id: { title: "Target" },
            },
          },
          {
            key: "target",
            level: "topic",
            materialKeys: [],
            order: 2,
            translations: {
              en: { title: "Target Again" },
              id: { title: "Target Again" },
            },
          },
        ],
      })
    ).toThrow("Duplicate curriculum node target in fixture-program.");

    expect(() =>
      defineCurriculum({
        programKey: "fixture-program",
        nodes: [
          {
            key: "target",
            level: "topic",
            materialKeys: [],
            order: 1,
            parentKey: "missing-parent",
            translations: {
              en: { title: "Target" },
              id: { title: "Target" },
            },
          },
        ],
      })
    ).toThrow("Unknown parent node missing-parent in fixture-program:target.");
  });

  it("rejects invalid curriculum node keys through the Effect Schema contract", () => {
    const result = Schema.decodeUnknownEither(CurriculumSourceSchema)({
      programKey: "fixture-program",
      nodes: [
        {
          key: "Invalid Node",
          level: "topic",
          materialKeys: [],
          order: 1,
          translations: {
            en: { title: "Target" },
            id: { title: "Target" },
          },
        },
      ],
    });

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(ParseResult.TreeFormatter.formatErrorSync(result.left)).toContain(
        "Invalid curriculum node key."
      );
    }
  });
});
