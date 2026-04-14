import type { Doc } from "@repo/backend/convex/_generated/dataModel";

/**
 * Build changed fields metadata for school updates
 */
export function buildSchoolChangesMetadata(
  oldSchool: Doc<"schools">,
  school: Doc<"schools">
) {
  const nameChanged = oldSchool.name !== school.name;
  const emailChanged = oldSchool.email !== school.email;
  const phoneChanged = oldSchool.phone !== school.phone;
  const addressChanged = oldSchool.address !== school.address;
  const cityChanged = oldSchool.city !== school.city;
  const provinceChanged = oldSchool.province !== school.province;
  const typeChanged = oldSchool.type !== school.type;
  const hasChanges = [
    nameChanged,
    emailChanged,
    phoneChanged,
    addressChanged,
    cityChanged,
    provinceChanged,
    typeChanged,
  ].some(Boolean);

  if (!hasChanges) {
    return null;
  }

  return {
    schoolName: school.name,
    ...(nameChanged ? { oldName: oldSchool.name, newName: school.name } : {}),
    ...(emailChanged
      ? { oldEmail: oldSchool.email, newEmail: school.email }
      : {}),
    ...(phoneChanged
      ? { oldPhone: oldSchool.phone, newPhone: school.phone }
      : {}),
    ...(addressChanged
      ? { oldAddress: oldSchool.address, newAddress: school.address }
      : {}),
    ...(cityChanged ? { oldCity: oldSchool.city, newCity: school.city } : {}),
    ...(provinceChanged
      ? { oldProvince: oldSchool.province, newProvince: school.province }
      : {}),
    ...(typeChanged ? { oldType: oldSchool.type, newType: school.type } : {}),
  };
}

/**
 * Build changed fields metadata for class updates
 */
export function buildClassChangesMetadata(
  oldClassDoc: Doc<"schoolClasses">,
  classDoc: Doc<"schoolClasses">
) {
  const nameChanged = oldClassDoc.name !== classDoc.name;
  const subjectChanged = oldClassDoc.subject !== classDoc.subject;
  const yearChanged = oldClassDoc.year !== classDoc.year;
  const visibilityChanged = oldClassDoc.visibility !== classDoc.visibility;
  const hasChanges = [
    nameChanged,
    subjectChanged,
    yearChanged,
    visibilityChanged,
  ].some(Boolean);

  if (!hasChanges) {
    return null;
  }

  return {
    className: classDoc.name,
    ...(nameChanged
      ? { oldName: oldClassDoc.name, newName: classDoc.name }
      : {}),
    ...(subjectChanged
      ? { oldSubject: oldClassDoc.subject, newSubject: classDoc.subject }
      : {}),
    ...(yearChanged
      ? { oldYear: oldClassDoc.year, newYear: classDoc.year }
      : {}),
    ...(visibilityChanged
      ? {
          oldVisibility: oldClassDoc.visibility,
          newVisibility: classDoc.visibility,
        }
      : {}),
  };
}
