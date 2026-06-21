import {
  PropertyEditIcon,
  StudyLampIcon,
  SwatchIcon,
} from "@hugeicons/core-free-icons";

/**
 * Resolves the icon used for an exercises category.
 *
 * @param category - Exercises category slug
 * @returns Hugeicons icon for the category
 */
export function getCategoryIcon(category: string) {
  switch (category) {
    case "middle-school":
      return StudyLampIcon;
    case "high-school":
      return SwatchIcon;
    default:
      return PropertyEditIcon;
  }
}
