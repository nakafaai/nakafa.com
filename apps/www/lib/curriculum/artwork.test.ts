// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
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

  it("maps signed grade and material identities to reviewed artwork", () => {
    expect(
      resolveCurriculumCatalogArtwork("de", {
        iconKey: "grade-10",
        kind: "route",
      })
    ).toBe("/open-graph/grade/de-10.png");
    expect(
      resolveCurriculumCatalogArtwork("de", {
        iconKey: "mathematics",
        kind: "route",
        materialDomain: MaterialDomainSchema.make("economy"),
      })
    ).toBe("/open-graph/subject/de-economics.png");
  });

  it("keeps unknown catalog identities on card gradients", () => {
    expect(
      resolveCurriculumCatalogArtwork("en", {
        kind: "program",
        programKey: LearningProgramKeySchema.make("future"),
      })
    ).toBeUndefined();
    expect(
      resolveCurriculumCatalogArtwork("en", {
        iconKey: "science",
        kind: "route",
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
