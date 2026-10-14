/**
 * Role values of the retired School class rows. The retired tables still
 * validate their stored rows with them until the change that drops the tables
 * also deletes this module.
 */
import { Schema } from "effect";

/**
 * School class member role validator
 */
export const schoolClassMemberRoleValidator = Schema.Literals([
  "teacher",
  "student",
]);

/**
 * School class teacher role validator (base type without optional wrapper)
 */
export const schoolClassTeacherRoleBaseValidator = Schema.Literals([
  "primary",
  "co-teacher",
  "assistant",
]);

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
