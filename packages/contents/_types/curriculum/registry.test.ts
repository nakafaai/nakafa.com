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

describe("curriculum registry", () => {
  it("maps Indonesia curriculum nodes to existing reusable material keys", () => {
    expect(getCurriculumSourceIssues()).toEqual([]);
    expect(
      getProgramKeysForMaterialRoute({
        route: "subject/high-school/10/mathematics/statistics",
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
        "subject/high-school/10/mathematics"
      )
    ).toBe(false);
  });

  it("returns no programs for routes outside the material registry", () => {
    expect(
      getProgramKeysForMaterialRoute({
        route: "subject/not-found",
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
          materialKeys: ["subject.high-school.10.biology"],
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
        route: "subject/high-school/10/mathematics/statistics",
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
