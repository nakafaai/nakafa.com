// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import { Array as Arr } from "effect";
import {
  getCurriculumIndexSocialImage,
  getCurriculumRouteSocialImage,
  resolveCurriculumArtwork,
} from "@/lib/curriculum/artwork";
import { listStaticArtworkPaths } from "@/lib/og/artwork";
import { testProgramClass, testProgramRoot } from "@/test/published/program";

/** The facts of a curriculum route that its artwork reads. */
type ArtworkRoute = Parameters<typeof resolveCurriculumArtwork>[1];

/** The root route of one program. */
function programRoot(programKey: string): ArtworkRoute {
  return {
    level: "track",
    nodeKey: `${programKey}:root`,
    programKey: LearningProgramKeySchema.make(programKey),
  };
}

/** A class or a stage route under its node key. */
function gradeRoute(
  nodeKey: string,
  level: "class" | "stage" = "class"
): ArtworkRoute {
  return {
    level,
    nodeKey,
    programKey: LearningProgramKeySchema.make("kssm"),
  };
}

/** A route of one level that teaches one subject. */
function subjectRoute(
  domain: string,
  level: "course" | "lesson" | "subject" | "topic" | "unit" = "subject"
): ArtworkRoute {
  return {
    level,
    materialDomain: MaterialDomainSchema.make(domain),
    nodeKey: `form-4-${domain}`,
    programKey: LearningProgramKeySchema.make("kssm"),
  };
}

/** A file of the static inventory, with its directory and the name after its locale. */
const INVENTORY_FILE =
  /^\/open-graph\/(?<directory>[a-z]+)\/[a-z]{2}-(?<name>.+)\.png$/u;

/** The artwork names of the inventory under one directory, such as `subject`. */
function inventoryNames(directory: string) {
  return Arr.dedupe(
    Arr.flatMap(listStaticArtworkPaths(), (file) => {
      const groups = INVENTORY_FILE.exec(file)?.groups;

      return groups?.directory === directory && groups.name !== undefined
        ? [groups.name]
        : [];
    })
  );
}

describe("curriculum artwork", () => {
  it("names a program root by its program, in the locale or in English", () => {
    expect(resolveCurriculumArtwork("de", programRoot("merdeka"))).toBe(
      "/open-graph/curriculum/de-merdeka.png"
    );
    expect(resolveCurriculumArtwork("id", programRoot("singapore-moe"))).toBe(
      "/open-graph/curriculum/en-singapore-moe.png"
    );
  });

  it.each(ACTIVE_APP_LOCALE_CODES)(
    "names a subject and a course by the subject they teach in %s",
    (locale) => {
      expect(resolveCurriculumArtwork(locale, subjectRoute("chemistry"))).toBe(
        `/open-graph/subject/${locale}-chemistry.png`
      );
      expect(
        resolveCurriculumArtwork(locale, subjectRoute("science", "course"))
      ).toBe(`/open-graph/subject/${locale}-science.png`);
    }
  );

  it.each(["unit", "topic", "lesson"] as const)(
    "names no artwork for a %s, which is a part of its subject",
    (level) => {
      expect(
        resolveCurriculumArtwork("en", subjectRoute("mathematics", level))
      ).toBeUndefined();
    }
  );

  it("names a class and a stage by their own node", () => {
    expect(resolveCurriculumArtwork("id", gradeRoute("class-10"))).toBe(
      "/open-graph/grade/id-class-10.png"
    );
    expect(
      resolveCurriculumArtwork("id", gradeRoute("upper-secondary", "stage"))
    ).toBe("/open-graph/grade/en-upper-secondary.png");
    expect(
      resolveCurriculumArtwork("de", gradeRoute("high-school", "stage"))
    ).toBe("/open-graph/grade/en-high-school.png");
  });

  it("draws the KSSM program and Form art, with Tingkatan where the class reads Tingkatan", () => {
    expect(resolveCurriculumArtwork("en", programRoot("kssm"))).toBe(
      "/open-graph/curriculum/en-kssm.png"
    );
    expect(resolveCurriculumArtwork("de", programRoot("kssm"))).toBe(
      "/open-graph/curriculum/en-kssm.png"
    );
    expect(resolveCurriculumArtwork("en", gradeRoute("form-4"))).toBe(
      "/open-graph/grade/en-form-4.png"
    );
    expect(resolveCurriculumArtwork("de", gradeRoute("form-5"))).toBe(
      "/open-graph/grade/en-form-5.png"
    );
    expect(resolveCurriculumArtwork("id", gradeRoute("form-4"))).toBe(
      "/open-graph/grade/id-form-4.png"
    );
    expect(resolveCurriculumArtwork("id", gradeRoute("form-5"))).toBe(
      "/open-graph/grade/id-form-5.png"
    );
  });

  it("draws the tile of a route that no design names yet", () => {
    expect(
      resolveCurriculumArtwork("en", programRoot("international-baccalaureate"))
    ).toBeUndefined();
    expect(
      resolveCurriculumArtwork("en", gradeRoute("form-6"))
    ).toBeUndefined();
    expect(
      resolveCurriculumArtwork("en", subjectRoute("geography"))
    ).toBeUndefined();
    expect(
      resolveCurriculumArtwork("en", {
        level: "subject",
        nodeKey: "form-4-general",
        programKey: LearningProgramKeySchema.make("kssm"),
      })
    ).toBeUndefined();
  });

  it.each(ACTIVE_APP_LOCALE_CODES)(
    "reaches every subject, grade and curriculum design of the inventory from the route that is it, in %s",
    (locale) => {
      const unreached = [
        ...Arr.filter(
          inventoryNames("subject"),
          (domain) =>
            resolveCurriculumArtwork(locale, subjectRoute(domain)) === undefined
        ),
        ...Arr.filter(
          inventoryNames("grade"),
          (nodeKey) =>
            resolveCurriculumArtwork(locale, gradeRoute(nodeKey)) === undefined
        ),
        ...Arr.filter(
          Arr.filter(inventoryNames("curriculum"), (name) => name !== "index"),
          (program) =>
            resolveCurriculumArtwork(locale, programRoot(program)) === undefined
        ),
      ];

      expect(unreached).toEqual([]);
    }
  );

  it("uses the reviewed index artwork and the curriculum section image for deeper routes", () => {
    expect(getCurriculumIndexSocialImage("de", "lehrplaene")).toBe(
      "/open-graph/curriculum/de-index.png"
    );
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("merdeka"),
        testProgramClass
      )
    ).toBe("/en/og/curriculum/image.png");
  });

  it("uses the program's artwork at a program root, and the generated image when it has none", () => {
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
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("kssm"),
        {
          ...testProgramRoot,
          publicPath: PublicPathSchema.make("curriculum/kssm"),
        }
      )
    ).toBe("/open-graph/curriculum/en-kssm.png");
    expect(
      getCurriculumRouteSocialImage(
        "en",
        LearningProgramKeySchema.make("international-baccalaureate"),
        {
          ...testProgramRoot,
          publicPath: PublicPathSchema.make(
            "curriculum/international-baccalaureate"
          ),
        }
      )
    ).toBe("/en/og/curriculum/image.png");
  });
});
