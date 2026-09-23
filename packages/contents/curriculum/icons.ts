import {
  Backpack01Icon,
  Building03Icon,
  GraduationScrollIcon,
  TeacherIcon,
  UniversityIcon,
} from "@hugeicons/core-free-icons";

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
