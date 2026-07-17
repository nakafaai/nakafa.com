import {
  CurriculumProjectionError,
  getProgramKeysForMaterialRoute,
  getProgramKeysForMaterialRouteFromNodes,
  listCurriculumNodes,
  projectCurriculumNodes,
} from "@repo/contents/_types/curriculum/projection";
import {
  type CurriculumNodeTranslationMap,
  CurriculumNodeTranslationMapSchema,
  CurriculumSourceSchema,
  defineCurriculum,
} from "@repo/contents/_types/curriculum/schema";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

const STATISTICS_KEY = "lesson.mathematics.statistics-foundations";
const PROBABILITY_KEY = "lesson.mathematics.probability";

function localizedDisplay(prefix: string) {
  return Schema.decodeUnknownSync(CurriculumNodeTranslationMapSchema)(
    Object.fromEntries(
      locales.map((locale) => [
        locale,
        { routeSlug: `${prefix}-${locale}`, title: `${prefix} ${locale}` },
      ])
    )
  );
}

function materialDisplay(material: MaterialSource) {
  return Schema.decodeUnknownSync(CurriculumNodeTranslationMapSchema)(
    Object.fromEntries(
      locales.map((locale) => [
        locale,
        {
          routeSlug: material.routeSlugs[locale],
          title: material.translations[locale].title,
        },
      ])
    )
  );
}

function materialCurriculum(materialKeys: readonly string[]) {
  return defineCurriculum({
    programKey: "fixture-program",
    tree: [{ key: "target", level: "lesson", materialKeys, order: 1 }],
  });
}

function materialCurriculumWithDisplay(
  materialKeys: readonly string[],
  displayOverride: CurriculumNodeTranslationMap
) {
  return defineCurriculum({
    programKey: "fixture-program",
    tree: [
      {
        displayOverride,
        key: "target",
        level: "lesson",
        materialKeys,
        order: 1,
      },
    ],
  });
}

describe("curriculum projection", () => {
  it("projects the canonical corpus and resolves material routes", async () => {
    const nodes = listCurriculumNodes();
    const effectNodes = await Effect.runPromise(projectCurriculumNodes());
    const statistics = MATERIAL_SOURCES.find(
      ({ key }) => key === STATISTICS_KEY
    );
    const statisticsNode = nodes.find(
      ({ key }) =>
        key === "class-10-mathematics-statistics-foundations-material"
    );

    expect(effectNodes).toEqual(nodes);
    expect(statistics).toBeDefined();
    if (!statistics) {
      return;
    }

    expect(statisticsNode?.translations).toEqual(materialDisplay(statistics));
    expect(Object.keys(statisticsNode?.translations ?? {}).sort()).toEqual(
      [...locales].sort()
    );
    expect(
      getProgramKeysForMaterialRoute({
        route: "material/lesson/mathematics/statistics-foundations",
      })
    ).toEqual([
      "cambridge-international",
      "merdeka",
      "singapore-moe",
      "united-states",
    ]);
    expect(
      getProgramKeysForMaterialRouteFromNodes({
        curriculumNodes: nodes,
        route: "curriculum/not-found",
      })
    ).toEqual([]);
  });

  it("supports inherited domains and explicit single- or multi-material copy", () => {
    const statistics = MATERIAL_SOURCES.find(
      ({ key }) => key === STATISTICS_KEY
    );
    if (!statistics) {
      expect(statistics).toBeDefined();
      return;
    }

    const sameTitleWithNewRoute = Schema.decodeUnknownSync(
      CurriculumNodeTranslationMapSchema
    )(
      Object.fromEntries(
        locales.map((locale) => [
          locale,
          {
            routeSlug: `statistics-custom-${locale}`,
            title: statistics.translations[locale].title,
          },
        ])
      )
    );
    const combinedDisplay = localizedDisplay("combined");
    const curriculum = defineCurriculum({
      programKey: "fixture-program",
      tree: [
        {
          children: [
            {
              key: "default-copy",
              level: "lesson",
              materialKeys: [STATISTICS_KEY],
              order: 1,
            },
            {
              displayOverride: sameTitleWithNewRoute,
              key: "custom-route",
              level: "lesson",
              materialKeys: [STATISTICS_KEY],
              order: 2,
            },
            {
              displayOverride: combinedDisplay,
              key: "combined",
              level: "lesson",
              materialKeys: [STATISTICS_KEY, PROBABILITY_KEY],
              order: 3,
            },
          ],
          key: "parent",
          level: "unit",
          materialDomain: "mathematics",
          order: 1,
          translations: localizedDisplay("parent"),
        },
      ],
    });
    const nodes = listCurriculumNodes({ curricula: [curriculum] });

    expect(
      nodes.find(({ key }) => key === "default-copy")?.translations
    ).toEqual(materialDisplay(statistics));
    expect(
      nodes.find(({ key }) => key === "custom-route")?.translations
    ).toEqual(sameTitleWithNewRoute);
    expect(nodes.find(({ key }) => key === "combined")).toEqual(
      expect.objectContaining({
        materialDomain: "mathematics",
        parentKey: "parent",
        translations: combinedDisplay,
      })
    );
    expect(
      getProgramKeysForMaterialRoute({
        curricula: [curriculum],
        materials: MATERIAL_SOURCES,
        route: "material/lesson/mathematics/statistics-foundations",
      })
    ).toEqual(["fixture-program"]);
  });

  it("reports projection failures and preserves the typed Effect error", async () => {
    const missingMaterial = materialCurriculum(["missing.material"]);
    const message =
      "Unknown material key missing.material in fixture-program:target";

    expect(() => listCurriculumNodes({ curricula: [missingMaterial] })).toThrow(
      message
    );

    const error = await Effect.runPromise(
      Effect.flip(projectCurriculumNodes({ curricula: [missingMaterial] }))
    );
    expect(error).toBeInstanceOf(CurriculumProjectionError);
    expect(error.message).toBe(message);
  });

  it("rejects missing, empty, duplicated, and ambiguous references", () => {
    const statistics = MATERIAL_SOURCES.find(
      ({ key }) => key === STATISTICS_KEY
    );
    if (!statistics) {
      expect(statistics).toBeDefined();
      return;
    }

    const single = materialCurriculum([STATISTICS_KEY]);
    const singleNode = single.tree[0];
    if (!(singleNode && "materialKeys" in singleNode)) {
      expect(singleNode).toBeDefined();
      return;
    }

    const cases = [
      {
        curriculum: {
          ...single,
          tree: [{ ...singleNode, materialKeys: [] }],
        },
        message:
          "Curriculum node fixture-program:target must reference at least one material key.",
      },
      {
        curriculum: materialCurriculumWithDisplay(
          [STATISTICS_KEY],
          materialDisplay(statistics)
        ),
        message:
          "Single-material curriculum node fixture-program:target duplicates material display copy.",
      },
      {
        curriculum: materialCurriculum([STATISTICS_KEY, PROBABILITY_KEY]),
        message:
          "Multi-material curriculum node fixture-program:target must define displayOverride.",
      },
      {
        curriculum: Schema.decodeUnknownSync(CurriculumSourceSchema)({
          programKey: "fixture-program",
          tree: [
            {
              key: "duplicate",
              level: "unit",
              order: 1,
              translations: localizedDisplay("first"),
            },
            {
              key: "duplicate",
              level: "unit",
              order: 2,
              translations: localizedDisplay("second"),
            },
          ],
        }),
        message: "Duplicate curriculum node duplicate in fixture-program",
      },
    ];

    for (const { curriculum, message } of cases) {
      expect(() => listCurriculumNodes({ curricula: [curriculum] })).toThrow(
        message
      );
    }
  });
});
