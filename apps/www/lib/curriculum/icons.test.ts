import { describe, expect, it } from "@effect/vitest";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { Array as Arr, Record as Rec } from "effect";
import {
  CURRICULUM_NAVIGATION_ICONS,
  readCurriculumRouteIcons,
} from "@/lib/curriculum/icons";
import {
  testProgramClass,
  testProgramRoot,
  testProgramSubject,
} from "@/test/content-program";

/** The subject route of the fixtures, with the icon key and the material domain of the test. */
function subjectWith(
  iconKey: "advanced" | "mathematics" | "science",
  domain: string
) {
  return CurriculumRouteSchema.make({
    ...testProgramSubject,
    iconKey,
    materialDomain: MaterialDomainSchema.make(domain),
  });
}

describe("readCurriculumRouteIcons", () => {
  it("gives a route that names no subject the navigation icon of its key", () => {
    expect(readCurriculumRouteIcons(testProgramRoot)).toEqual([
      CURRICULUM_NAVIGATION_ICONS.school,
    ]);
    expect(readCurriculumRouteIcons(testProgramClass)).toEqual([
      CURRICULUM_NAVIGATION_ICONS["grade-11"],
    ]);
  });

  it("gives a subject route the icon of its subject", () => {
    expect(readCurriculumRouteIcons(testProgramSubject)).toEqual(
      getMaterialIcons("mathematics")
    );
  });

  it("keeps the icon of the subject under the generic science key", () => {
    expect(readCurriculumRouteIcons(subjectWith("science", "biology"))).toEqual(
      getMaterialIcons("biology")
    );
  });

  it("keeps the navigation icon of a specific key over the subject", () => {
    expect(
      readCurriculumRouteIcons(subjectWith("advanced", "mathematics"))
    ).toEqual([CURRICULUM_NAVIGATION_ICONS.advanced]);
  });

  it("offers the spare icons to a subject that it does not know yet", () => {
    expect(
      readCurriculumRouteIcons(subjectWith("mathematics", "pottery"))
    ).toBe(SPARE_ICONS);
  });
});

describe("CURRICULUM_NAVIGATION_ICONS", () => {
  it("draws every navigation key with an icon of its own", () => {
    const icons = Rec.values(CURRICULUM_NAVIGATION_ICONS);

    expect(Arr.dedupe(icons)).toHaveLength(icons.length);
  });
});
