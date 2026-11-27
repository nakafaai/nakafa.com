// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { Array as Arr } from "effect";
import {
  getCurriculumIndexSocialImage,
  getCurriculumRouteSocialImage,
  resolveCurriculumArtwork,
} from "@/lib/curriculum/artwork";
import { testProgramClass, testProgramRoot } from "@/test/published/program";

/** The card file of one node in each locale, in the order en, id, de, ms. */
function cardFiles(nodeKey: string) {
  return Arr.map(ACTIVE_APP_LOCALE_CODES, (locale) =>
    resolveCurriculumArtwork(locale, { nodeKey })
  );
}

describe("curriculum card artwork", () => {
  it("draws each program's design, lettered with the program's own name", () => {
    expect(cardFiles("merdeka:root")).toEqual([
      "/open-graph/curriculum/id-merdeka.png",
      "/open-graph/curriculum/id-merdeka.png",
      "/open-graph/curriculum/id-merdeka.png",
      "/open-graph/curriculum/id-merdeka.png",
    ]);
    expect(cardFiles("singapore-moe:root")).toEqual([
      "/open-graph/curriculum/en-singapore-moe.png",
      "/open-graph/curriculum/en-singapore-moe.png",
      "/open-graph/curriculum/en-singapore-moe.png",
      "/open-graph/curriculum/en-singapore-moe.png",
    ]);
  });

  it("draws a plain subject in each locale's own lettering", () => {
    expect(cardFiles("class-10-mathematics")).toEqual([
      "/open-graph/subject/en-mathematics.png",
      "/open-graph/subject/id-mathematics.png",
      "/open-graph/subject/de-mathematics.png",
      "/open-graph/subject/ms-mathematics.png",
    ]);
    expect(cardFiles("form-5-physics")).toEqual([
      "/open-graph/subject/en-physics.png",
      "/open-graph/subject/id-physics.png",
      "/open-graph/subject/de-physics.png",
      "/open-graph/subject/ms-physics.png",
    ]);
    // Malay reads Kimia, the Indonesian lettering.
    expect(cardFiles("secondary-chemistry")[3]).toBe(
      "/open-graph/subject/id-chemistry.png"
    );
  });

  it("draws a class in Tingkatan or Kelas where its label reads so", () => {
    expect(cardFiles("form-4")).toEqual([
      "/open-graph/grade/en-form-4.png",
      "/open-graph/grade/id-form-4.png",
      "/open-graph/grade/en-form-4.png",
      "/open-graph/grade/id-form-4.png",
    ]);
    expect(cardFiles("class-12")[3]).toBe("/open-graph/grade/id-class-12.png");
  });

  it("draws a tile in a locale whose lettering is not drawn yet", () => {
    expect(cardFiles("upper-secondary")).toEqual([
      "/open-graph/grade/en-upper-secondary.png",
      "/open-graph/grade/en-upper-secondary.png",
      "/open-graph/grade/de-upper-secondary.png",
      undefined,
    ]);
    expect(cardFiles("secondary-additional-mathematics")).toEqual([
      "/open-graph/subject/en-additional-mathematics.png",
      "/open-graph/subject/en-additional-mathematics.png",
      "/open-graph/subject/de-additional-mathematics.png",
      undefined,
    ]);
    // KSSM names it Matematika Tambahan and Erweiterte Mathematik.
    expect(cardFiles("form-4-additional-mathematics")).toEqual([
      "/open-graph/subject/en-additional-mathematics.png",
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("draws each Studienkolleg's own mark", () => {
    expect(cardFiles("hannover")).toEqual(
      Arr.replicate("/open-graph/grade/de-hannover.png", 4)
    );
    expect(resolveCurriculumArtwork("id", { nodeKey: "tu-darmstadt" })).toBe(
      "/open-graph/grade/de-tu-darmstadt.png"
    );
  });

  it.each([
    "hannover-t-mathematics",
    "hannover-m-biology",
    "sachsen-m-mathematics",
    "biology-0610",
    "mathematics-0580",
    "class-11-advanced-mathematics",
    "gymnasiale-oberstufe:root",
    "qualification-phase-1",
    "studienkolleg:root",
  ])("draws a tile for %s, which no design names yet", (nodeKey) => {
    expect(cardFiles(nodeKey)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("uses the reviewed index artwork and the generated image for deeper routes", () => {
    expect(getCurriculumIndexSocialImage("de", "lehrplaene")).toBe(
      "/open-graph/curriculum/de-index.png"
    );
    expect(getCurriculumRouteSocialImage("en", testProgramClass)).toBe(
      "/en/og/curriculum/image.png"
    );
  });

  it("uses the program's artwork at a program root, and the generated image when it has none", () => {
    expect(getCurriculumRouteSocialImage("de", testProgramRoot)).toBe(
      "/open-graph/curriculum/id-merdeka.png"
    );
    expect(
      getCurriculumRouteSocialImage("en", {
        ...testProgramRoot,
        nodeKey: "international-baccalaureate:root",
        publicPath: PublicPathSchema.make(
          "curriculum/international-baccalaureate"
        ),
      })
    ).toBe("/en/og/curriculum/image.png");
  });
});
