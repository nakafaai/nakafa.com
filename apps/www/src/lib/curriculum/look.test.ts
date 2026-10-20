import { describe, expect, it } from "@effect/vitest";
import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
import {
  CurriculumNodeKeySchema,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
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

/** A class route of the fixtures under another node key. */
function classWith(nodeKey: string) {
  return CurriculumRouteSchema.make({
    ...testProgramClass,
    nodeKey: CurriculumNodeKeySchema.make(nodeKey),
  });
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

  it("names the artwork of a route in its place", () => {
    const [art, tile] = getCurriculumLooks(
      [testProgramRoot, testProgramClass],
      (route) => (route === testProgramRoot ? "root.png" : undefined)
    );

    expect(art).toBe("root.png");
    expect(tile).toMatchObject({ seed: testProgramClass.nodeKey });
  });

  it("takes no hue for a route with artwork from the tiles around it", () => {
    // The own hues of these two classes are one degree apart, so the second
    // would be turned away from the first if the first drew a tile.
    const first = classWith("class-6");
    const second = classWith("class-7");
    const withArtwork = getCurriculumLooks([first, second], (route) =>
      route === first ? "class-6.png" : undefined
    );
    const alone = getCurriculumLooks([first, second]);

    expect(withArtwork[1]).toMatchObject({ shift: 0 });
    expect(alone[1]).not.toMatchObject({ shift: 0 });
  });

  it("does not count a route with artwork as the first route of its subject", () => {
    const [art, tile] = getCurriculumLooks(
      [
        subjectWith("mathematics", "mathematics", "class-10-mathematics"),
        testProgramSubject,
      ],
      (route) => (route === testProgramSubject ? undefined : "class-10.png")
    );

    expect(art).toBe("class-10.png");
    expect(tile).toMatchObject({
      icon: Arr.headNonEmpty(getMaterialIcons("mathematics")),
    });
  });
});
