import {
  Backpack01Icon,
  GraduationScrollIcon,
  LibraryIcon,
  Notebook01Icon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";

/**
 * Gets the path to the category of the subject.
 * @param category - The category to get the path for.
 * @returns The path to the category.
 */
export function getCategoryPath(category: SubjectCategory) {
  return `/subject/${category}` as const;
}

/**
 * Gets the icon for the category of the subject.
 * @param category - The category to get the icon for.
 * @returns The icon for the category.
 */
export function getCategoryIcon(category: SubjectCategory) {
  switch (category) {
    case "elementary-school":
      return Backpack01Icon;
    case "middle-school":
      return Notebook01Icon;
    case "high-school":
      return LibraryIcon;
    case "university":
      return UniversityIcon;
    default:
      return GraduationScrollIcon;
  }
}
