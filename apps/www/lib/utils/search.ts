import type { PagefindResult } from "@/types/pagefind";

// Define the valid heading elements and their corresponding margin classes
const HEADING_STYLES = {
  h3: "ml-5",
  h4: "ml-9",
  h5: "ml-13",
  h6: "ml-17",
} as const;

type HeadingElement = keyof typeof HEADING_STYLES;

/**
 * Check if the element is a valid heading element
 */
function isHeadingElement(element: string): element is HeadingElement {
  return element in HEADING_STYLES;
}

/**
 * Get the style for the anchor element
 * @param anchor - The anchor element
 * @returns The style for the anchor element
 */
export function getAnchorStyle(
  anchor: PagefindResult["sub_results"][number]["anchor"]
): string | null {
  if (!anchor || !isHeadingElement(anchor.element)) {
    return null;
  }

  return `${HEADING_STYLES[anchor.element]} rounded-l-md`;
}
