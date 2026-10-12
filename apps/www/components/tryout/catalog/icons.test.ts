import { describe, expect, it } from "@effect/vitest";
import type { IconSvgElement } from "@hugeicons/react";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { PRESENTED_MATERIAL_DOMAINS } from "@repo/contents/taxonomy";
import { getTileLooks } from "@repo/design-system/lib/tile";
import { Array as Arr, Record as Rec } from "effect";
import {
  getTryoutExamIcons,
  getTryoutSubjectIcons,
  getTryoutTrackIcons,
  TRYOUT_EXAM_ICONS,
  TRYOUT_INSTITUTION_ICONS,
  TRYOUT_SUBJECT_ICONS,
  TRYOUT_YEAR_ICONS,
} from "@/components/tryout/catalog/icons";
import { CURRICULUM_NAVIGATION_ICONS } from "@/lib/curriculum/icons";

/** UTBK-SNBT subtests under their official names, in exam order. */
const SNBT_SECTIONS = [
  "general-reasoning",
  "general-knowledge-and-understanding",
  "reading-comprehension-and-writing",
  "quantitative-knowledge",
  "literacy-in-indonesian",
  "literacy-in-english",
  "mathematical-reasoning",
];
/** The subjects of the TKA, which are also its tracks. */
const TKA_SUBJECTS = [
  "compulsory-mathematics",
  "indonesian-language",
  "english-language",
];
/** A UTBK-SNBT set holds seven sections, the longest list of tiles that the product shows at once. */
const LONGEST_LIST = SNBT_SECTIONS.length;

/** The icon that each pool gives to its tile in one list, the tiles having different seeds. */
function iconsOf(pools: readonly Arr.NonEmptyReadonlyArray<IconSvgElement>[]) {
  return Arr.map(
    getTileLooks(
      Arr.map(pools, (pool, index) => [pool, `key-${index}`] as const)
    ),
    ({ icon }) => icon
  );
}

describe("try-out icons", () => {
  it("draws every icon of the product for one key only", () => {
    const icons = Arr.flatten([
      Rec.values(TRYOUT_EXAM_ICONS),
      Rec.values(TRYOUT_SUBJECT_ICONS),
      TRYOUT_YEAR_ICONS,
      TRYOUT_INSTITUTION_ICONS,
      SPARE_ICONS,
      Rec.values(CURRICULUM_NAVIGATION_ICONS),
      Arr.flatMap(PRESENTED_MATERIAL_DOMAINS, (material) =>
        getLessonIcons(material)
      ),
    ]);

    expect(Arr.dedupe(icons)).toHaveLength(icons.length);
  });

  it("gives every section of the UTBK-SNBT and every subject of the TKA an icon of its own", () => {
    for (const key of [...SNBT_SECTIONS, ...TKA_SUBJECTS]) {
      expect(getTryoutSubjectIcons(key)).toHaveLength(1);
      expect(getTryoutSubjectIcons(key)).not.toBe(SPARE_ICONS);
    }
  });

  it("keeps the icon of a subject track the icon of its section", () => {
    expect(getTryoutTrackIcons("subject", "english-language")).toEqual(
      getTryoutSubjectIcons("english-language")
    );
  });

  it("reuses the icon of a curriculum subject for a subject that is one", () => {
    expect(getTryoutSubjectIcons("physics")).toEqual(
      getMaterialIcons("physics")
    );
  });

  it("gives year tracks calendars and institution tracks buildings, whatever their key", () => {
    expect(getTryoutTrackIcons("year", "2027")).toBe(TRYOUT_YEAR_ICONS);
    expect(getTryoutTrackIcons("institution", "studienkolleg")).toBe(
      TRYOUT_INSTITUTION_ICONS
    );
    expect(getTryoutTrackIcons("institution", "physics")).toBe(
      TRYOUT_INSTITUTION_ICONS
    );
  });

  it("offers the spare icons for an exam or a subject that it does not know", () => {
    expect(getTryoutExamIcons("unknown-exam")).toBe(SPARE_ICONS);
    expect(getTryoutSubjectIcons("unknown-subject")).toBe(SPARE_ICONS);
    expect(getTryoutTrackIcons("subject", "unknown-track")).toBe(SPARE_ICONS);
  });

  it("holds more calendars, buildings, and spare icons than the longest list", () => {
    expect(TRYOUT_YEAR_ICONS.length).toBeGreaterThan(LONGEST_LIST);
    expect(TRYOUT_INSTITUTION_ICONS.length).toBeGreaterThan(LONGEST_LIST);
    expect(SPARE_ICONS.length).toBeGreaterThan(LONGEST_LIST);
  });

  it("tells the exams of a country apart", () => {
    const icons = iconsOf(
      Arr.map(["snbt", "tka"], (key) => getTryoutExamIcons(key))
    );

    expect(Arr.dedupe(icons)).toHaveLength(2);
  });

  it("gives a set of sections that it does not know one icon each", () => {
    const unknown = Arr.makeBy(LONGEST_LIST, (index) => `section-${index}`);
    const icons = iconsOf(
      Arr.map(unknown, (key) => getTryoutSubjectIcons(key))
    );

    expect(Arr.dedupe(icons)).toHaveLength(LONGEST_LIST);
  });

  it("gives year tracks one calendar each", () => {
    const years = Arr.makeBy(LONGEST_LIST, () =>
      getTryoutTrackIcons("year", "2027")
    );

    expect(Arr.dedupe(iconsOf(years))).toHaveLength(LONGEST_LIST);
  });
});
