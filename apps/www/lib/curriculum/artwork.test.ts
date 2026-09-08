// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import {
  getCurriculumIndexSocialImage,
  getCurriculumRouteSocialImage,
  resolveCurriculumCatalogArtwork,
} from "@/lib/curriculum/artwork";
import { testProgramClass, testProgramRoot } from "@/test/content-program";

describe("curriculum artwork", () => {
  it("resolves exact and English-default program artwork", () => {
    expect(
      resolveCurriculumCatalogArtwork("de", {
        kind: "program",
        programKey: LearningProgramKeySchema.make("merdeka"),
      })
    ).toBe("/open-graph/curriculum/de-merdeka.png");
    expect(
      resolveCurriculumCatalogArtwork("id", {
        kind: "program",
        programKey: LearningProgramKeySchema.make("singapore-moe"),
      })
    ).toBe("/open-graph/curriculum/en-singapore-moe.png");
    expect(
      resolveCurriculumCatalogArtwork("de", {
        kind: "program",
        programKey: LearningProgramKeySchema.make("united-states"),
      })
    ).toBe("/open-graph/curriculum/en-united-states.png");
  });

  it.each(["en", "id", "de"] as const)(
    "distinguishes Mathematics from courses and topics sharing its domain in %s",
    (locale) => {
      const programKey = LearningProgramKeySchema.make("singapore-moe");
      expect(
        resolveCurriculumCatalogArtwork(locale, {
          kind: "route",
          programKey,
          nodeKey: "secondary-mathematics",
        })
      ).toBe(`/open-graph/subject/${locale}-mathematics.png`);

      for (const nodeKey of [
        "secondary-additional-mathematics",
        "secondary-mathematics-number-algebra",
        "secondary-additional-mathematics-functions-calculus",
      ]) {
        expect(
          resolveCurriculumCatalogArtwork(locale, {
            kind: "route",
            programKey,
            nodeKey,
          })
        ).toBeUndefined();
      }
    }
  );

  it.each([
    ["merdeka", "class-11-mathematics"],
    ["cambridge-international", "mathematics-0580"],
    ["united-states", "high-school-mathematics"],
  ])("preserves reviewed Mathematics artwork for %s", (program, nodeKey) => {
    expect(
      resolveCurriculumCatalogArtwork("de", {
        kind: "route",
        programKey: LearningProgramKeySchema.make(program),
        nodeKey,
      })
    ).toBe("/open-graph/subject/de-mathematics.png");
  });

  it("preserves reviewed discipline artwork within the combined science course", () => {
    const programKey = LearningProgramKeySchema.make("singapore-moe");
    expect(
      resolveCurriculumCatalogArtwork("id", {
        kind: "route",
        programKey,
        nodeKey: "secondary-science-physics",
      })
    ).toBe("/open-graph/subject/id-physics.png");
    expect(
      resolveCurriculumCatalogArtwork("id", {
        kind: "route",
        programKey,
        nodeKey: "secondary-science",
      })
    ).toBeUndefined();
  });

  it.each(["en", "id", "de"] as const)(
    "preserves reviewed stage and grade artwork in %s",
    (locale) => {
      expect(
        resolveCurriculumCatalogArtwork(locale, {
          kind: "route",
          programKey: LearningProgramKeySchema.make("merdeka"),
          nodeKey: "class-10",
        })
      ).toBe(`/open-graph/grade/${locale}-10.png`);
      expect(
        resolveCurriculumCatalogArtwork(locale, {
          kind: "route",
          programKey: LearningProgramKeySchema.make("cambridge-international"),
          nodeKey: "upper-secondary",
        })
      ).toBe(
        `/open-graph/grade/${locale === "id" ? "en" : locale}-upper-secondary.png`
      );
      expect(
        resolveCurriculumCatalogArtwork(locale, {
          kind: "route",
          programKey: LearningProgramKeySchema.make("singapore-moe"),
          nodeKey: "secondary",
        })
      ).toBe(
        `/open-graph/grade/${locale === "id" ? "en" : locale}-secondary.png`
      );
    }
  );

  it("does not infer artwork from another program or a shared school icon", () => {
    for (const nodeKey of [
      "secondary",
      "secondary-mathematics",
      "lower-secondary",
      "class-10",
    ]) {
      expect(
        resolveCurriculumCatalogArtwork("en", {
          kind: "route",
          programKey: LearningProgramKeySchema.make("cambridge-international"),
          nodeKey,
        })
      ).toBeUndefined();
    }
    expect(
      resolveCurriculumCatalogArtwork("en", {
        kind: "program",
        programKey: LearningProgramKeySchema.make("future"),
      })
    ).toBeUndefined();
  });

  it("uses generated artwork for the index and deeper routes", () => {
    expect(getCurriculumIndexSocialImage("de", "lehrplaene")).toBe(
      "/de/og/lehrplaene/image.png"
    );
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("merdeka"),
        testProgramClass
      )
    ).toBe("/en/og/curriculum/merdeka/class-11/image.png");
  });

  it("uses stable program identity only at a program root", () => {
    expect(
      getCurriculumRouteSocialImage(
        "id",
        LearningProgramKeySchema.make("cambridge-international"),
        {
          ...testProgramRoot,
          publicPath: PublicPathSchema.make(
            "kurikulum/cambridge-international"
          ),
        }
      )
    ).toBe("/open-graph/curriculum/en-cambridge-international.png");
  });
});
