import {
  Backpack01Icon,
  Building03Icon,
  GraduationScrollIcon,
  TeacherIcon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";

/**
 * Builds the public path for a subject category page.
 *
 * @param category - Subject category slug
 * @returns Canonical category path
 */
export function getCategoryPath(category: SubjectCategory) {
  return `/subject/${category}` as const;
}

/**
 * Resolves the icon used for a subject category.
 *
 * @param category - Subject category slug
 * @returns Hugeicons icon for the category
 */
export function getCategoryIcon(category: string) {
  switch (category) {
    case "elementary-school":
      return Backpack01Icon;
    case "middle-school":
      return TeacherIcon;
    case "high-school":
      return Building03Icon;
    case "university":
      return UniversityIcon;
    default:
      return GraduationScrollIcon;
  }
}

/** Narrows one subject category route segment to the supported category union. */
export function parseSubjectCategory(value: string) {
  const parsedCategory = SubjectCategorySchema.safeParse(value);

  if (!parsedCategory.success) {
    return null;
  }

  return parsedCategory.data;
}
