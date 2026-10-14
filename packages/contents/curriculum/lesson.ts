import { BACHELOR_LESSON_ICONS } from "@repo/contents/curriculum/lesson/bachelor";
import { SCHOOL_LESSON_ICONS } from "@repo/contents/curriculum/lesson/school";
import { getMaterialIcons } from "@repo/contents/curriculum/material";
import { SPARE_ICONS } from "@repo/contents/curriculum/spare";
import { isPresentedMaterialDomain } from "@repo/contents/taxonomy";
import { Array as Arr } from "effect";

/**
 * The icons of every subject beyond its own. The two taxonomy lists, high
 * school and bachelor, are the two modules that hold them, and the compiler
 * asks each for a family of every subject of its list.
 */
const lessonIconsByKey = { ...SCHOOL_LESSON_ICONS, ...BACHELOR_LESSON_ICONS };

/**
 * Resolves the icons that a lesson of a subject may show, so that lessons of
 * one subject differ from each other. The family of a subject starts with its
 * own icon (see `getMaterialIcons`) and is longer than the longest list of
 * tiles that the corpus holds. Every icon of a family reads as that subject to
 * someone who sees only the tile. No icon belongs to two families, to the spare
 * icons, or to any other key of the product, and no two of them, in one family
 * or across families, draw the same object at 40px, so a learner of one subject
 * sees a family of different things and a list of lessons of several subjects
 * never shows two alike. The product-wide test of icons in
 * `apps/www/components/tryout/catalog/icons.test.ts` checks the length of every
 * pool of icons and that no icon belongs to two keys. A subject the product
 * does not know yet offers the spare icons.
 *
 * A lesson takes one of them from its own key, and a list of lessons takes them
 * apart (see `getTileLooks` in the design system).
 *
 * @param material - Material slug of the subject that the lesson belongs to
 * @returns Hugeicons icons for a lesson of the subject, never empty
 */
export function getLessonIcons(material: string) {
  return isPresentedMaterialDomain(material)
    ? Arr.appendAll(getMaterialIcons(material), lessonIconsByKey[material])
    : SPARE_ICONS;
}
