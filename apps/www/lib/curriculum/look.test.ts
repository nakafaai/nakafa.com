import { describe, expect, it } from "@effect/vitest";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { Array as Arr } from "effect";
import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";
import { getCurriculumLooks } from "@/lib/curriculum/look";
import {
  testProgramClass,
  testProgramRoot,
  testProgramSubject,
} from "@/test/content-program";

/** A subject route of the fixtures, with the icon key, the material domain, and the node key of the test. */
function subjectWith(
  iconKey: "advanced" | "mathematics" | "science",
  domain: string,
  nodeKey = testProgramSubject.nodeKey
) {
  return CurriculumRouteSchema.make({
    ...testProgramSubject,
    iconKey,
    materialDomain: MaterialDomainSchema.make(domain),
    nodeKey,
  });
}

/** The icon that each route of one list gets. */
function iconsOf(routes: Parameters<typeof getCurriculumLooks>[0]) {
  return Arr.map(getCurriculumLooks(routes), ({ icon }) => icon);
}

describe("getCurriculumLooks", () => {
  it("gives a route that names no subject the navigation icon of its key", () => {
    expect(iconsOf([testProgramRoot, testProgramClass])).toEqual([
      CURRICULUM_NAVIGATION_ICONS.school,
      CURRICULUM_NAVIGATION_ICONS["grade-11"],
    ]);
  });

  it("gives a subject route the own icon of its subject", () => {
    expect(iconsOf([testProgramSubject])).toEqual(
      getMaterialIcons("mathematics")
    );
  });

  it("keeps the icon of the subject under the generic science key", () => {
    expect(iconsOf([subjectWith("science", "biology")])).toEqual(
      getMaterialIcons("biology")
    );
  });

  it("keeps the navigation icon of a specific key over the subject", () => {
    expect(iconsOf([subjectWith("advanced", "mathematics")])).toEqual([
      CURRICULUM_NAVIGATION_ICONS.advanced,
    ]);
  });

  it("offers the spare icons to a subject that it does not know yet", () => {
    const icons = iconsOf([subjectWith("mathematics", "pottery")]);

    expect(icons).toHaveLength(1);
    expect(Arr.every(icons, (icon) => Arr.contains(SPARE_ICONS, icon))).toBe(
      true
    );
  });

  it("gives two routes of one subject two icons of its family, its own first", () => {
    const family = getLessonIcons("mathematics");
    const looks = getCurriculumLooks([
      testProgramSubject,
      subjectWith("mathematics", "mathematics", "class-10-mathematics"),
    ]);
    const icons = Arr.map(looks, ({ icon }) => icon);

    expect(icons[0]).toEqual(Arr.headNonEmpty(family));
    expect(Arr.dedupe(icons)).toHaveLength(2);
    expect(Arr.every(icons, (icon) => Arr.contains(family, icon))).toBe(true);
    expect(Arr.map(looks, ({ seed }) => seed)).toEqual([
      "class-11-mathematics",
      "class-10-mathematics",
    ]);
  });

  it("takes the node key of each route as its seed", () => {
    const looks = getCurriculumLooks([testProgramRoot, testProgramClass]);

    expect(Arr.map(looks, ({ seed }) => seed)).toEqual([
      testProgramRoot.nodeKey,
      testProgramClass.nodeKey,
    ]);
  });
});
