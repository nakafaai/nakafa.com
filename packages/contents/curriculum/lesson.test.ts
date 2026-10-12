import { describe, expect, it } from "@effect/vitest";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { PRESENTED_MATERIAL_DOMAINS } from "@repo/contents/taxonomy";
import { Array as Arr } from "effect";

/**
 * The seven sections of a UTBK-SNBT set are the longest list of tiles that the
 * product shows at once. The home trending list shows six lessons.
 */
const LONGEST_LIST = 7;

describe("getLessonIcons", () => {
  it("starts the family of each subject with the icon of the subject", () => {
    for (const material of PRESENTED_MATERIAL_DOMAINS) {
      expect(Arr.headNonEmpty(getLessonIcons(material))).toEqual(
        Arr.headNonEmpty(getMaterialIcons(material))
      );
    }
  });

  it("gives every family more icons than the longest list of lessons, none of them twice", () => {
    for (const material of PRESENTED_MATERIAL_DOMAINS) {
      const family = getLessonIcons(material);

      expect(family.length).toBeGreaterThan(LONGEST_LIST);
      expect(Arr.dedupe(family)).toHaveLength(family.length);
    }
  });

  it("gives no icon to two subjects, and none to the spares", () => {
    const icons = Arr.appendAll(
      Arr.flatMap(PRESENTED_MATERIAL_DOMAINS, (material) =>
        getLessonIcons(material)
      ),
      SPARE_ICONS
    );

    expect(Arr.dedupe(icons)).toHaveLength(icons.length);
  });

  it("offers the spare icons to lessons of a subject that it does not know yet", () => {
    expect(getLessonIcons("unknown-material")).toBe(SPARE_ICONS);
  });
});
