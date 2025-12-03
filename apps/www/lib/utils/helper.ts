/**
 * Get the initial name of a user.
 * @param name - The name of the user (optional)
 * @returns The initial name of the user (default: "NF")
 */
export function getInitialName(name?: string) {
  const trimmedName = name?.trim() ?? "";

  if (!trimmedName) {
    return "NF";
  }

  const nameParts = trimmedName.split(" ").filter((part) => part.length > 0);

  if (nameParts.length === 1) {
    // Single name: return first letter
    return nameParts[0][0].toUpperCase();
  }

  // Multiple names: return first and last initials
  const firstInitial = nameParts[0][0];
  const lastInitial = nameParts.at(-1)?.[0] ?? "";

  return `${firstInitial}${lastInitial}`.toUpperCase();
}

/**
 * Converts a URL slug to a readable title.
 * Handles URL encoding, various separators, and proper capitalization.
 * @param slug - The URL slug to convert
 * @returns A clean, readable title
 */
export function convertSlugToTitle(slug: string): string {
  try {
    // First decode the URL-encoded slug
    const decoded = decodeURIComponent(slug);

    // Replace various separators with spaces and clean up
    return decoded
      .replace(/[-_+]/g, " ") // Replace dashes, underscores, and plus signs
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .trim() // Remove leading/trailing whitespace
      .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
  } catch {
    // Fallback if decoding fails - silently handle malformed URLs
    return slug
      .replace(/[-_+]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

/**
 * Truncates a text to a maximum length.
 * @param text - The text to truncate
 * @param maxLength - The maximum length of the text
 * @returns The truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength).trim()}...`;
}

/**
 * Helper function to check if pathname ends with a specific segment
 * Example: /school/slug/classes -> matches "classes"
 * Example: /school/slug/classes/123 -> does not match "classes"
 */
export function pathEndsWith(pathname: string, segment: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts.at(-1) === segment;
}
