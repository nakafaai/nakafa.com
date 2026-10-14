import { describe, expect, it } from "@effect/vitest";
import type { IconSvgElement } from "@hugeicons/react";
import { getLessonIcons } from "@repo/contents/curriculum/lesson";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { PRESENTED_MATERIAL_DOMAINS } from "@repo/contents/taxonomy";
import { getTileLooks, TILE_HUE_GAP } from "@repo/design-system/lib/look";
import { readSeed, TURN, wrap } from "@repo/design-system/lib/tile";
import { Array as Arr, Record as Rec, Tuple } from "effect";
import { ARTICLE_CATEGORY_ICONS } from "@/components/articles/category";
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

/** The exams of the catalog. */
const EXAMS = ["snbt", "tka"];
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
/**
 * The longest list of tiles that the corpus holds, counted from the source
 * trees of the Aksara corpus (`packages/corpus/curriculum`) and not from
 * memory: the classes 1 to 8 of the Merdeka curriculum. Classes 9 to 12 draw
 * reviewed artwork, which takes no tile (`CURRICULUM_ARTWORK_BY_IDENTITY`), so
 * the root of that curriculum lists twelve cards and eight tiles once every
 * class is published; today the corpus publishes only the three classes that
 * hold lessons. The other lists are shorter: seven sections in a UTBK-SNBT set,
 * six lessons in the trending list of the home page, and no more than five
 * cards, four of them tiles, in any other list of the corpus.
 */
const LONGEST_LIST = 8;

/** Every pool of icons that a list draws its tiles from, with the name of its owner. */
const POOLS = [
  Tuple.make("the spare icons", SPARE_ICONS),
  Tuple.make("the year tracks", TRYOUT_YEAR_ICONS),
  Tuple.make("the institution tracks", TRYOUT_INSTITUTION_ICONS),
  ...Arr.map(PRESENTED_MATERIAL_DOMAINS, (material) =>
    Tuple.make(`the lessons of ${material}`, getLessonIcons(material))
  ),
];

/** The icon that each pool gives to its tile in one list, the tiles having different seeds. */
function iconsOf(pools: readonly Arr.NonEmptyReadonlyArray<IconSvgElement>[]) {
  return Arr.map(
    getTileLooks(
      Arr.map(pools, (pool, index) => Tuple.make(pool, `key-${index}`))
    ),
    ({ icon }) => icon
  );
}

/** The one icon that a lookup gives to a key it knows. */
function ownIcon(pool: Arr.NonEmptyReadonlyArray<IconSvgElement>) {
  expect(pool).toHaveLength(1);

  return Arr.headNonEmpty(pool);
}

/**
 * This file owns the property that no icon is the icon of two keys, and that no
 * pool is shorter than the longest list, because it is the one place that
 * reads every map of the product that names an icon for a key: the subjects
 * and their lessons and the spare icons (`@repo/contents`), the try-out exams,
 * subjects, years, and institutions, the curriculum navigation keys, which
 * also name the stages of the sidebar and the search palette, and the article
 * categories. Only `apps/www` imports all of them, and of its owners the
 * try-out catalog holds the most icons, so the rule sits with its lookups.
 * Another test that restates it would only repeat this one.
 */
describe("icons of the product", () => {
  it("draws every icon of the product for one key only", () => {
    const icons = Arr.flatten([
      Rec.values(TRYOUT_EXAM_ICONS),
      Rec.values(TRYOUT_SUBJECT_ICONS),
      TRYOUT_YEAR_ICONS,
      TRYOUT_INSTITUTION_ICONS,
      SPARE_ICONS,
      Rec.values(CURRICULUM_NAVIGATION_ICONS),
      Rec.values(ARTICLE_CATEGORY_ICONS),
      Arr.flatMap(PRESENTED_MATERIAL_DOMAINS, (material) =>
        getLessonIcons(material)
      ),
    ]);

    expect(Arr.dedupe(icons)).toHaveLength(icons.length);
  });

  it.each(POOLS)(
    "gives %s more icons than the longest list of tiles",
    (_owner, pool) => {
      expect(pool.length).toBeGreaterThan(LONGEST_LIST);
    }
  );
});

describe("try-out icons", () => {
  it("gives every exam of the catalog exactly its own icon, different from every other", () => {
    const icons = Arr.map(EXAMS, (key) => ownIcon(getTryoutExamIcons(key)));

    expect(icons).toEqual(Arr.map(EXAMS, (key) => TRYOUT_EXAM_ICONS[key]));
    expect(Arr.dedupe(icons)).toHaveLength(EXAMS.length);
  });

  it("gives every section of the UTBK-SNBT and every subject of the TKA exactly its own icon, different from every other", () => {
    const keys = [...SNBT_SECTIONS, ...TKA_SUBJECTS];
    const icons = Arr.map(keys, (key) => ownIcon(getTryoutSubjectIcons(key)));

    expect(icons).toEqual(Arr.map(keys, (key) => TRYOUT_SUBJECT_ICONS[key]));
    expect(Arr.dedupe(icons)).toHaveLength(keys.length);
  });

  it("gives a subject track the icon of its section", () => {
    for (const key of TKA_SUBJECTS) {
      expect(getTryoutTrackIcons("subject", key)).toEqual(
        getTryoutSubjectIcons(key)
      );
    }
  });

  it("reuses the icon of a curriculum subject for a subject that is one", () => {
    expect(getTryoutSubjectIcons("physics")).toEqual(
      getMaterialIcons("physics")
    );
  });

  it("gives year tracks drawings of time and institution tracks buildings, whatever their key", () => {
    expect(getTryoutTrackIcons("year", "2027")).toBe(TRYOUT_YEAR_ICONS);
    expect(getTryoutTrackIcons("institution", "studienkolleg")).toBe(
      TRYOUT_INSTITUTION_ICONS
    );
    expect(getTryoutTrackIcons("institution", "physics")).toBe(
      TRYOUT_INSTITUTION_ICONS
    );
  });

  it("offers the spare icons for an exam or a subject that it does not know, also under the name of an object method", () => {
    for (const key of ["unknown-exam", "constructor", "toString"]) {
      expect(getTryoutExamIcons(key)).toBe(SPARE_ICONS);
      expect(getTryoutSubjectIcons(key)).toBe(SPARE_ICONS);
    }
    expect(getTryoutTrackIcons("subject", "unknown-track")).toBe(SPARE_ICONS);
  });

  it("gives a set of sections that it does not know one icon each", () => {
    const unknown = Arr.makeBy(
      SNBT_SECTIONS.length,
      (index) => `section-${index}`
    );
    const icons = iconsOf(
      Arr.map(unknown, (key) => getTryoutSubjectIcons(key))
    );

    expect(Arr.dedupe(icons)).toHaveLength(SNBT_SECTIONS.length);
  });

  it("gives year tracks one drawing of time each, as many as the longest list", () => {
    const years = Arr.makeBy(LONGEST_LIST, () =>
      getTryoutTrackIcons("year", "2027")
    );
    const icons = iconsOf(years);

    expect(Arr.dedupe(icons)).toHaveLength(LONGEST_LIST);
    expect(
      Arr.every(icons, (icon) => Arr.contains(TRYOUT_YEAR_ICONS, icon))
    ).toBe(true);
  });
});

/** The middle hue of each tile of one list, as the list places its tiles by their keys. */
function middlesOf(keys: readonly string[]) {
  return Arr.map(
    getTileLooks(Arr.map(keys, (key) => Tuple.make(SPARE_ICONS, key))),
    ({ seed, shift }) => wrap(readSeed(seed).middle + shift)
  );
}

/** The least distance between any two hues of a list, the short way around the wheel. */
function leastDistance(hues: readonly number[]) {
  return Arr.reduce(hues, TURN, (least, hue, index) =>
    Arr.reduce(Arr.drop(hues, index + 1), least, (nearest, other) => {
      const apart = Math.abs(hue - other);

      return Math.min(nearest, apart, TURN - apart);
    })
  );
}

describe("tiles of the longest lists", () => {
  it("keeps the classes of the Merdeka curriculum and the sections of a UTBK-SNBT set the full gap apart", () => {
    const classes = Arr.makeBy(LONGEST_LIST, (index) => `class-${index + 1}`);

    for (const keys of [classes, SNBT_SECTIONS]) {
      expect(leastDistance(middlesOf(keys))).toBeGreaterThanOrEqual(
        TILE_HUE_GAP
      );
    }
  });
});
