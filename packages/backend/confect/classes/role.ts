import { Schema } from "effect";
/**
 * School class member role validator
 */
export const schoolClassMemberRoleValidator = Schema.Literals([
  "teacher",
  "student",
]);
export type SchoolClassMemberRole = typeof schoolClassMemberRoleValidator.Type;

/**
 * School class teacher role validator (base type without optional wrapper)
 */
export const schoolClassTeacherRoleBaseValidator = Schema.Literals([
  "primary",
  "co-teacher",
  "assistant",
]);
export type SchoolClassTeacherRole =
  typeof schoolClassTeacherRoleBaseValidator.Type;

/**
 * School class teacher role validator (with optional wrapper for schema use)
 */
export const schoolClassTeacherRoleValidator = Schema.optionalKey(
  schoolClassTeacherRoleBaseValidator
);

/**
 * School class enroll method validator
 */
export const schoolClassEnrollMethodValidator = Schema.optionalKey(
  Schema.Literals(["by_code", "teacher", "admin", "invite", "public"])
);
