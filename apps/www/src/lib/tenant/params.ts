import { Id, type TableNames } from "@repo/backend/confect/_generated/id";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import { DiscussionNumber } from "@repo/backend/confect/classroom/forum/message";
import { Schema } from "effect";

/**
 * What a Convex document ID is: 31 to 37 characters of Convex's lowercase base32. Convex refuses any
 * other text with a server error that a page can only show as a failed load, so an address that
 * cannot name a row stops here and answers not found.
 */
const DOCUMENT_ID = /^[0-9a-hjkmnp-tv-z]{31,37}$/u;

/** The ID of a row of `table` at an address, or none when the address cannot name a row. */
const readDocumentId = <const Table extends TableNames>(
  table: Table,
  address: string
) =>
  Schema.decodeOption(
    Schema.String.check(Schema.isPattern(DOCUMENT_ID)).pipe(
      Schema.decodeTo(Id(table))
    )
  )(address);

/** The exam at an address of a school, or none when the address names no exam. */
export function readExamId(exam: string) {
  return readDocumentId("exams", exam);
}

/** The sitting at an address of a school, or none when the address names no sitting. */
export function readSittingId(sitting: string) {
  return readDocumentId("examSittings", sitting);
}

/** The cohort at an address of the school settings, or none when the address names no cohort. */
export function readCohortId(cohort: string) {
  return readDocumentId("tenantCohorts", cohort);
}

/** The class at an address of a school, such as `fisika-x-1`, or none when the address names no class. */
export function readClassAddress(classSlug: string) {
  return Schema.decodeOption(ClassAddress)(classSlug);
}

/** The folder at an address of a class's library, or none when the address names no folder. */
export function readFolderAddress(folder: string) {
  return readDocumentId("classroomFolders", folder);
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
  return Schema.decodeOption(DiscussionAddress)(number);
}
