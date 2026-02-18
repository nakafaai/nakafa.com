import type { Doc } from "@repo/backend/convex/_generated/dataModel";

/**
 * Build changed fields metadata for school updates
 */
export function buildSchoolChangesMetadata(
  oldSchool: Doc<"schools">,
  school: Doc<"schools">
): Record<string, string | undefined> | null {
  const fields = [
    "name",
    "email",
    "phone",
    "address",
    "city",
    "province",
    "type",
  ] as const;

  const changes: Record<string, string | undefined> = {
    schoolName: school.name,
  };
  let hasChanges = false;

  for (const field of fields) {
    if (oldSchool[field] !== school[field]) {
      hasChanges = true;
      const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
      changes[`old${capitalized}`] = oldSchool[field];
      changes[`new${capitalized}`] = school[field];
    }
  }

  return hasChanges ? changes : null;
}

/**
 * Build changed fields metadata for class updates
 */
export function buildClassChangesMetadata(
  oldClassDoc: Doc<"schoolClasses">,
  classDoc: Doc<"schoolClasses">
): Record<string, string | number | undefined> | null {
  const fields = ["name", "subject", "year", "visibility"] as const;

  const changes: Record<string, string | number | undefined> = {
    className: classDoc.name,
  };
  let hasChanges = false;

  for (const field of fields) {
    if (oldClassDoc[field] !== classDoc[field]) {
      hasChanges = true;
      const capitalized = field.charAt(0).toUpperCase() + field.slice(1);
      changes[`old${capitalized}`] = oldClassDoc[field];
      changes[`new${capitalized}`] = classDoc[field];
    }
  }

  return hasChanges ? changes : null;
}
