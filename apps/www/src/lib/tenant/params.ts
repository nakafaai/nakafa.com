import { Id } from "@repo/backend/confect/_generated/id";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import { Schema } from "effect";

/** The exam at an address of a school, or none when the address names no exam. */
export function readExamId(exam: string) {
  return Schema.decodeUnknownOption(Id("exams"))(exam);
}

/** The sitting at an address of a school, or none when the address names no sitting. */
export function readSittingId(sitting: string) {
  return Schema.decodeUnknownOption(Id("examSittings"))(sitting);
}

/** The cohort at an address of the school settings, or none when the address names no cohort. */
export function readCohortId(cohort: string) {
  return Schema.decodeUnknownOption(Id("tenantCohorts"))(cohort);
}

/** The class at an address of a school, such as `fisika-x-1`, or none when the address names no class. */
export function readClassAddress(classSlug: string) {
  return Schema.decodeOption(ClassAddress)(classSlug);
}

/** The digits of a discussion's address: a number without a leading zero. */
const DiscussionAddress = Schema.String.check(
  Schema.isPattern(/^[1-9][0-9]{0,8}$/u)
).pipe(
  Schema.decodeTo(Schema.FiniteFromString),
  Schema.decodeTo(DiscussionNumber)
);

/** The discussion at an address of a class's forum, such as `12`, or none when the address names no discussion. */
export function readDiscussionNumber(number: string) {
  return Schema.decodeUnknownOption(DiscussionAddress)(number);
}
