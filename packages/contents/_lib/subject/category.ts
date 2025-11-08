import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import {
  BackpackIcon,
  GraduationCapIcon,
  LibraryIcon,
  NotebookIcon,
  UniversityIcon,
} from "lucide-react";
import { createElement } from "react";

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
      return createElement(BackpackIcon);
    case "middle-school":
      return createElement(NotebookIcon);
    case "high-school":
      return createElement(LibraryIcon);
    case "university":
      return createElement(UniversityIcon);
    default:
      return createElement(GraduationCapIcon);
  }
}
