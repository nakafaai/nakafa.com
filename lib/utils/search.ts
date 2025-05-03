import type { PagefindResult } from "@/types/pagefind";

/**
 * Get the style for the anchor element
 * @param anchor - The anchor element
 * @returns The style for the anchor element
 */
export function getAnchorStyle(
  anchor: PagefindResult["sub_results"][number]["anchor"]
) {
  if (!anchor) {
    return null;
  }
  if (anchor.element === "h3") {
    return "ml-5";
  }
  if (anchor.element === "h4") {
    return "ml-9";
  }
  if (anchor.element === "h5") {
    return "ml-13";
  }
  if (anchor.element === "h6") {
    return "ml-17";
  }
  return null;
}
