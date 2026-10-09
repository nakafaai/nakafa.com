import {
  Backpack01Icon,
  Building03Icon,
  GraduationScrollIcon,
  TeacherIcon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";
import { Match } from "effect";

/**
 * Resolves the icon used for a subject category.
 *
 * @param category - Subject category slug
 * @returns Hugeicons icon for the category
 */
export const getCategoryIcon = Match.type<string>().pipe(
  Match.when("elementary-school", () => Backpack01Icon),
  Match.when("middle-school", () => TeacherIcon),
  Match.when("high-school", () => Building03Icon),
  Match.when("university", () => UniversityIcon),
  Match.orElse(() => GraduationScrollIcon)
);
