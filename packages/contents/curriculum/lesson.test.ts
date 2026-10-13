import { describe, expect, it } from "@effect/vitest";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { PRESENTED_MATERIAL_DOMAINS } from "@repo/contents/taxonomy";
import { Array as Arr } from "effect";

describe("getLessonIcons", () => {
  it("starts the family of each subject with the icon of the subject", () => {
    for (const material of PRESENTED_MATERIAL_DOMAINS) {
      expect(Arr.headNonEmpty(getLessonIcons(material))).toEqual(
        Arr.headNonEmpty(getMaterialIcons(material))
      );
    }
  });

  it("offers the spare icons to lessons of a subject that it does not know yet", () => {
    expect(getLessonIcons("unknown-material")).toBe(SPARE_ICONS);
  });
});
