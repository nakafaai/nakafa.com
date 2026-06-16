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

const CURRICULUM_SOURCE_ROOT = join(process.cwd(), "_types", "curriculum");
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
  it("maps Indonesia curriculum nodes to existing reusable material keys", () => {
    expect(getCurriculumSourceIssues()).toEqual([]);
    expect(
      getProgramKeysForMaterialRoute({
        route: "material/lesson/mathematics/statistics-foundations",
      })
    ).toEqual(["id-kurikulum-merdeka"]);
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

  it("reports unknown parent and material references", () => {
    const invalid = defineCurriculum({
      programKey: "fixture-program",
      nodes: [
        {
          key: "target",
          level: "topic",
          materialKeys: ["missing.material"],
          order: 1,
          parentKey: "missing-parent",
          translations: {
            en: { title: "Target" },
            id: { title: "Target" },
          },
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Unknown parent node missing-parent in fixture-program:target",
      "Unknown material key missing.material in fixture-program:target",
    ]);
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
