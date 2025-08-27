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
