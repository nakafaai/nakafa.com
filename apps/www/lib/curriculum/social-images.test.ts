// @vitest-environment node

import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { describe, expect, it } from "vitest";
import {
  getCurriculumIndexSocialImage,
  getCurriculumRouteSocialImage,
} from "@/lib/curriculum/social-images";
import { testProgramClass, testProgramRoot } from "@/test/content-program";

describe("curriculum social images", () => {
  it("resolves both localized Curriculum index images", () => {
    expect(getCurriculumIndexSocialImage("en")).toBe(
      "/open-graph/curriculum/en-index.png"
    );
    expect(getCurriculumIndexSocialImage("id")).toBe(
      "/open-graph/curriculum/id-index.png"
    );
  });

  it("uses stable program identities for localized curriculum roots", () => {
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("merdeka"),
        testProgramRoot
      )
    ).toBe("/open-graph/curriculum/en-merdeka.png");
    expect(
      getCurriculumRouteSocialImage(
        "id",
        LearningProgramKeySchema.make("cambridge-international"),
        testProgramRoot
      )
    ).toBe("/open-graph/curriculum/id-cambridge-international.png");
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("singapore-moe"),
        testProgramRoot
      )
    ).toBe("/open-graph/curriculum/en-singapore-moe.png");
    expect(
      getCurriculumRouteSocialImage(
        "id",
        LearningProgramKeySchema.make("united-states"),
        testProgramRoot
      )
    ).toBe("/open-graph/curriculum/id-united-states.png");
  });

  it("keeps route-specific images for deeper curriculum pages", () => {
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("merdeka"),
        testProgramClass
      )
    ).toBe("/en/og/curriculum/merdeka/class-11/image.png");
  });
});
