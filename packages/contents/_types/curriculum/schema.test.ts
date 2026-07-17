import {
  CurriculumMaterialReferenceNodeSchema,
  CurriculumNodeKeySchema,
  CurriculumNodeSchema,
  CurriculumNodeTranslationMapSchema,
  CurriculumSourceDefinitionError,
  classNode,
  courseNode,
  defineCurriculum,
  defineCurriculumSources,
  materialNode,
  stageNode,
  subjectNode,
  unitNode,
} from "@repo/contents/_types/curriculum/schema";
import { locales } from "@repo/utilities/locales";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

function localizedTranslations(prefix: string) {
  return Schema.decodeUnknownSync(CurriculumNodeTranslationMapSchema)(
    Object.fromEntries(
      locales.map((locale) => [
        locale,
        {
          routeSlug: `${prefix}-${locale}`,
          title: `${prefix} ${locale}`,
        },
      ])
    )
  );
}

describe("curriculum schemas", () => {
  it("requires one translation for every canonical locale", () => {
    const translations = localizedTranslations("target");
    const incompleteTranslations = Object.fromEntries(
      locales.slice(1).map((locale) => [locale, translations[locale]])
    );

    expect(Object.keys(translations).sort()).toEqual([...locales].sort());
    expect(
      Either.isLeft(
        Schema.decodeUnknownEither(CurriculumNodeTranslationMapSchema)(
          incompleteTranslations
        )
      )
    ).toBe(true);
  });

  it("rejects invalid node keys and empty material references", () => {
    const invalidKey = Schema.decodeUnknownEither(CurriculumNodeKeySchema)(
      "Invalid Node"
    );
    const emptyReference = Schema.decodeUnknownEither(
      CurriculumMaterialReferenceNodeSchema
    )({
      key: "target",
      level: "topic",
      materialKeys: [],
      order: 1,
    });

    expect(Either.isLeft(invalidKey)).toBe(true);
    if (Either.isLeft(invalidKey)) {
      expect(
        ParseResult.TreeFormatter.formatErrorSync(invalidKey.left)
      ).toContain("Invalid curriculum node key.");
    }
    expect(Either.isLeft(emptyReference)).toBe(true);
  });

  it("defines every structure level through the schema-owned helpers", () => {
    const translations = localizedTranslations("structure");
    const nodes = [
      classNode({ key: "class-node", order: 1, translations }),
      subjectNode({ key: "subject-node", order: 2, translations }),
      courseNode({ key: "course-node", order: 3, translations }),
      stageNode({ key: "stage-node", order: 4, translations }),
      unitNode({ key: "unit-node", order: 5, translations }),
    ];

    expect(nodes.map(({ level }) => level)).toEqual([
      "class",
      "subject",
      "course",
      "stage",
      "unit",
    ]);
  });

  it("decodes recursive trees, material leaves, and source arrays", () => {
    const leaf = materialNode({
      key: "material-leaf",
      level: "topic",
      materialKeys: ["lesson.mathematics.statistics-foundations"],
      order: 1,
    });
    const curricula = defineCurriculumSources([
      {
        programKey: "fixture-program",
        tree: [
          {
            children: [leaf],
            key: "parent",
            level: "unit",
            order: 1,
            translations: localizedTranslations("parent"),
          },
        ],
      },
    ]);
    const decodedNode = Schema.decodeUnknownSync(CurriculumNodeSchema)({
      key: "material-leaf",
      level: "topic",
      materialKeys: leaf.materialKeys,
      order: 1,
      parentKey: "parent",
      translations: localizedTranslations("leaf"),
    });
    const root = curricula[0]?.tree[0];

    expect(root).toBeDefined();
    if (!(root && "children" in root)) {
      return;
    }

    expect(root.children?.[0]?.key).toBe("material-leaf");
    expect(curricula[0]?.programKey).toBe("fixture-program");
    expect(decodedNode.parentKey).toBe("parent");
  });

  it("fails duplicate keys anywhere in an authored tree with a typed error", () => {
    const duplicate = () =>
      defineCurriculum({
        programKey: "fixture-program",
        tree: [
          {
            children: [
              {
                key: "duplicate",
                level: "unit",
                order: 1,
                translations: localizedTranslations("child"),
              },
            ],
            key: "duplicate",
            level: "unit",
            order: 1,
            translations: localizedTranslations("parent"),
          },
        ],
      });

    expect(duplicate).toThrow(CurriculumSourceDefinitionError);
    expect(duplicate).toThrow(
      "Duplicate curriculum node duplicate in fixture-program."
    );
  });
});
