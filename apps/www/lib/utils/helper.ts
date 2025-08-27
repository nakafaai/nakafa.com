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
