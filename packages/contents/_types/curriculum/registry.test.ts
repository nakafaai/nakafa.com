import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getCurriculumProjectionIssues,
  getProgramKeysForMaterialRoute,
  listCurriculumNodes,
  listCurriculumNodesEffect,
} from "@repo/contents/_types/curriculum/projection";
import {
  getCurriculumSourceIssues,
  listCurricula,
} from "@repo/contents/_types/curriculum/registry";
import {
  CurriculumNodeSchema,
  CurriculumSourceSchema,
  defineCurriculum,
  defineCurriculumTree,
} from "@repo/contents/_types/curriculum/schema";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { Effect, Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

const CURRICULUM_SOURCE_ROOT = join(process.cwd(), "curriculum");
const LEARNING_PROGRAM_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
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
    expect(getCurriculumProjectionIssues()).toEqual([]);
    expect(getCurriculumSourceIssues()).toEqual([]);
    expect(
      getProgramKeysForMaterialRoute({
        route: "material/lesson/mathematics/statistics-foundations",
      })
    ).toEqual(["cambridge-igcse", "id-kurikulum-merdeka"]);
  });

  it("projects nested curriculum authoring into flat read-model rows", () => {
    const curricula = listCurricula();
    const projectedNodes = listCurriculumNodes();
    const merdeka = curricula.find(
      (curriculum) => curriculum.programKey === "id-kurikulum-merdeka"
    );

    expect(merdeka?.tree.some((node) => node.key === "class-10")).toBe(true);
    expect(projectedNodes.some((node) => node.key === "class-10")).toBe(true);
    expect(
      JSON.stringify(merdeka?.tree).includes(
        "curriculum/high-school/10/mathematics"
      )
    ).toBe(false);
  });

  it("decodes nested curriculum trees through the schema-owned helper", () => {
    const tree = defineCurriculumTree([
      {
        key: "target",
        level: "unit",
        order: 1,
        translations: {
          en: { title: "Target" },
          id: { title: "Target" },
        },
      },
    ]);

    expect(tree[0]?.key).toBe("target");
  });

  it("projects curriculum nodes through the Effect entrypoint", async () => {
    const nodes = await Effect.runPromise(listCurriculumNodesEffect());

    expect(nodes.some((node) => node.key === "class-10")).toBe(true);
  });

  it("inherits single-material leaf display from the Material source", () => {
    const material = MATERIAL_SOURCES.find(
      (source) => source.key === "lesson.mathematics.statistics-foundations"
    );
    const node = listCurriculumNodes().find(
      (curriculumNode) =>
        curriculumNode.key === "class-10-mathematics-statistics-foundations"
    );

    expect(material?.kind).toBe("lesson");
    expect(node?.translations).toEqual(
      material?.kind === "lesson" ? material.translations : undefined
    );
  });

  it("keeps curriculum sources free of public route folder paths", () => {
    const routePathSources = readCurriculumSourceFiles(
      CURRICULUM_SOURCE_ROOT
    ).filter((source) => PUBLIC_ROUTE_FOLDER_PATTERN.test(source));

    expect(routePathSources).toEqual([]);
  });

  it("keeps each real curriculum behind a folder-owned source module", () => {
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
    const usStandards = listCurriculumNodes().filter(
      (node) => node.curriculumKey === "us-common-core-ngss"
    );

    expect(usStandards.length).toBeGreaterThan(0);
    expect(usStandards.flatMap((node) => node.materialKeys)).toEqual([]);
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
      tree: [
        {
          key: "target",
          level: "topic",
          materialKeys: ["lesson.biology.biodiversity"],
          order: 1,
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
      tree: [
        {
          children: [
            {
              key: "target",
              level: "topic",
              materialKeys: ["missing.material"],
              order: 2,
            },
          ],
          key: "parent",
          level: "unit",
          order: 1,
          translations: {
            en: { title: "Parent" },
            id: { title: "Parent" },
          },
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Unknown material key missing.material in fixture-program:target",
    ]);
  });

  it("reports empty material reference nodes defensively", () => {
    const valid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          key: "target",
          level: "topic",
          materialKeys: ["lesson.mathematics.statistics-foundations"],
          order: 1,
        },
      ],
    });
    const materialNode = valid.tree[0];

    if (!(materialNode && "materialKeys" in materialNode)) {
      throw new Error("Missing material reference fixture.");
    }

    const invalid = {
      ...valid,
      tree: [{ ...materialNode, materialKeys: [] }],
    };

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Curriculum node fixture-program:target must reference at least one material key.",
    ]);
  });

  it("throws when projecting invalid curriculum sources directly", () => {
    const invalid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          key: "target",
          level: "topic",
          materialKeys: ["missing.material"],
          order: 1,
        },
      ],
    });

    expect(() => listCurriculumNodes({ curricula: [invalid] })).toThrow(
      "Unknown material key missing.material in fixture-program:target"
    );
  });

  it("fails the Effect projection entrypoint with typed projection errors", async () => {
    const invalid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          key: "target",
          level: "topic",
          materialKeys: ["missing.material"],
          order: 1,
        },
      ],
    });

    await expect(
      Effect.runPromise(listCurriculumNodesEffect({ curricula: [invalid] }))
    ).rejects.toThrow(
      "Unknown material key missing.material in fixture-program:target"
    );
  });

  it("reports duplicated single-material display overrides", () => {
    const material = MATERIAL_SOURCES.find(
      (source) => source.key === "lesson.mathematics.statistics-foundations"
    );

    if (material?.kind !== "lesson") {
      throw new Error("Missing fixture material.");
    }

    const invalid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          displayOverride: material.translations,
          key: "target",
          level: "topic",
          materialKeys: [material.key],
          order: 1,
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Single-material curriculum node fixture-program:target duplicates material display copy.",
    ]);
  });

  it("accepts a distinct single-material curriculum display override", () => {
    const material = MATERIAL_SOURCES.find(
      (source) => source.key === "lesson.mathematics.statistics-foundations"
    );

    if (material?.kind !== "lesson") {
      throw new Error("Missing fixture material.");
    }

    const valid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          displayOverride: {
            en: { title: "Statistics in the curriculum" },
            id: { title: "Statistika dalam kurikulum" },
          },
          key: "target",
          level: "topic",
          materialKeys: [material.key],
          order: 1,
        },
      ],
    });

    expect(
      listCurriculumNodes({ curricula: [valid] })[0]?.translations
    ).toEqual({
      en: { title: "Statistics in the curriculum" },
      id: { title: "Statistika dalam kurikulum" },
    });
  });

  it("reports multi-material leaves without explicit curriculum display copy", () => {
    const invalid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          key: "combined-target",
          level: "topic",
          materialKeys: [
            "lesson.mathematics.statistics-foundations",
            "lesson.mathematics.probability",
          ],
          order: 1,
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Multi-material curriculum node fixture-program:combined-target must define displayOverride.",
    ]);
  });

  it("projects multi-material leaves when curriculum display copy is explicit", () => {
    const valid = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          displayOverride: {
            en: { title: "Probability and statistics" },
            id: { title: "Peluang dan statistika" },
          },
          key: "combined-target",
          level: "topic",
          materialKeys: [
            "lesson.mathematics.statistics-foundations",
            "lesson.mathematics.probability",
          ],
          order: 1,
        },
      ],
    });

    expect(listCurriculumNodes({ curricula: [valid] })).toEqual([
      expect.objectContaining({
        key: "combined-target",
        materialKeys: [
          "lesson.mathematics.statistics-foundations",
          "lesson.mathematics.probability",
        ],
        translations: {
          en: { title: "Probability and statistics" },
          id: { title: "Peluang dan statistika" },
        },
      }),
    ]);
  });

  it("projects one-group practice material copy and rejects ambiguous practice copy", () => {
    const practice = MATERIAL_SOURCES.find(
      (source) =>
        source.key === "practice.assessment.snbt.quantitative-knowledge"
    );

    if (practice?.kind !== "practice") {
      throw new Error("Missing practice fixture material.");
    }

    const oneGroupPractice = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          key: "practice-target",
          level: "topic",
          materialKeys: [practice.key],
          order: 1,
        },
      ],
    });
    const multiGroupPractice = {
      ...practice,
      groups: [
        ...practice.groups,
        {
          ...practice.groups[0],
          exerciseType: "review",
          translations: {
            en: { title: "Review" },
            id: { title: "Ulasan" },
          },
        },
      ],
    } satisfies MaterialSource;

    expect(
      listCurriculumNodes({ curricula: [oneGroupPractice] })[0]?.translations
    ).toEqual(practice.groups[0]?.translations);
    expect(
      getCurriculumSourceIssues({
        curricula: [oneGroupPractice],
        materials: [multiGroupPractice],
      })
    ).toEqual([
      "Curriculum node fixture-program:practice-target references material practice.assessment.snbt.quantitative-knowledge without projectable material copy.",
    ]);

    const overridePractice = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          displayOverride: {
            en: { title: "Practice review" },
            id: { title: "Ulasan latihan" },
          },
          key: "practice-target",
          level: "topic",
          materialKeys: [practice.key],
          order: 1,
        },
      ],
    });

    expect(
      listCurriculumNodes({
        curricula: [overridePractice],
        materials: [multiGroupPractice],
      })[0]?.translations
    ).toEqual({
      en: { title: "Practice review" },
      id: { title: "Ulasan latihan" },
    });
  });

  it("reports defensive duplicate issues for decoded source data", () => {
    const decodeCurriculumSource = Schema.decodeUnknownSync(
      CurriculumSourceSchema
    );
    const invalid = decodeCurriculumSource({
      programKey: "fixture-program",
      tree: [
        {
          key: "target",
          level: "unit",
          order: 1,
          translations: {
            en: { title: "Target" },
            id: { title: "Target" },
          },
        },
        {
          key: "target",
          level: "unit",
          order: 2,
          translations: {
            en: { title: "Target Again" },
            id: { title: "Target Again" },
          },
        },
      ],
    });

    expect(getCurriculumSourceIssues({ curricula: [invalid] })).toEqual([
      "Duplicate curriculum node target in fixture-program",
    ]);
  });

  it("fails fast for duplicate node keys", () => {
    expect(() =>
      defineCurriculum({
        programKey: "fixture-program",
        tree: [
          {
            key: "target",
            level: "unit",
            order: 1,
            translations: {
              en: { title: "Target" },
              id: { title: "Target" },
            },
          },
          {
            key: "target",
            level: "unit",
            order: 2,
            translations: {
              en: { title: "Target Again" },
              id: { title: "Target Again" },
            },
          },
        ],
      })
    ).toThrow("Duplicate curriculum node target in fixture-program.");
  });

  it("rejects invalid curriculum node keys through the Effect Schema contract", () => {
    const result = Schema.decodeUnknownEither(CurriculumSourceSchema)({
      programKey: "fixture-program",
      tree: [
        {
          key: "Invalid Node",
          level: "unit",
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

  it("keeps projected rows compatible with the flat Curriculum node contract", () => {
    const projectedNodes = listCurriculumNodes();

    for (const node of projectedNodes) {
      const decoded = Schema.decodeUnknownSync(CurriculumNodeSchema)(node);

      expect(decoded.key).toBe(node.key);
      expect(node.curriculumKey).toMatch(LEARNING_PROGRAM_KEY_PATTERN);
    }
  });
});
