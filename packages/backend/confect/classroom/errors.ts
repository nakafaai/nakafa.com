import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A name that another active class of the same cohort already has, compared without case. */
export class ClassNameTaken extends Schema.TaggedError<
  ClassNameTaken,
  { readonly brand: unique symbol }
>()(
  "ClassNameTaken",
  refusal(
    "CLASS_NAME_TAKEN",
    "Another active class of this cohort has this name."
  )
) {}

/** A subject that another active class of the cohort already teaches, when a rename gave that class another name. */
export class ClassSubjectTaken extends Schema.TaggedError<
  ClassSubjectTaken,
  { readonly brand: unique symbol }
>()(
  "ClassSubjectTaken",
  refusal(
    "CLASS_SUBJECT_TAKEN",
    "Another active class of this cohort already teaches this subject."
  )
) {}

/** A class without a subject outside an SD cohort, where a class names the subject it teaches. */
export class ClassSubjectRequired extends Schema.TaggedError<
  ClassSubjectRequired,
  { readonly brand: unique symbol }
>()(
  "ClassSubjectRequired",
  refusal(
    "CLASS_SUBJECT_REQUIRED",
    "Only the homeroom class of an SD cohort may have no subject."
  )
) {}

/** A subject in an SD cohort, which holds only its homeroom class and that class has no subject. */
export class ClassSubjectNotAllowed extends Schema.TaggedError<
  ClassSubjectNotAllowed,
  { readonly brand: unique symbol }
>()(
  "ClassSubjectNotAllowed",
  refusal(
    "CLASS_SUBJECT_NOT_ALLOWED",
    "An SD cohort holds only its homeroom class, which has no subject."
  )
) {}

/** Creating a class in a cohort that already holds the most classes it can. */
export class ClassLimit extends Schema.TaggedError<
  ClassLimit,
  { readonly brand: unique symbol }
>()(
  "ClassLimit",
  refusal("CLASS_LIMIT", "This cohort holds the most classes it can.")
) {}

/** Adding a folder to a class library that already holds the most folders it can. */
export class FolderLimit extends Schema.TaggedError<
  FolderLimit,
  { readonly brand: unique symbol }
>()(
  "FolderLimit",
  refusal("FOLDER_LIMIT", "This library holds the most folders it can.")
) {}

/** Pinning an announcement to a class home that already keeps the most it can. */
export class PinLimit extends Schema.TaggedError<
  PinLimit,
  { readonly brand: unique symbol }
>()(
  "PinLimit",
  refusal("PIN_LIMIT", "This class keeps the most pinned announcements it can.")
) {}

/** Scheduling an announcement in a class that holds the most it can waiting. */
export class ScheduledLimit extends Schema.TaggedError<
  ScheduledLimit,
  { readonly brand: unique symbol }
>()(
  "ScheduledLimit",
  refusal(
    "SCHEDULED_LIMIT",
    "This class holds the most scheduled announcements it can."
  )
) {}

/** Scheduling an announcement for a time that has passed. */
export class ScheduledPast extends Schema.TaggedError<
  ScheduledPast,
  { readonly brand: unique symbol }
>()(
  "ScheduledPast",
  refusal("SCHEDULED_PAST", "An announcement needs a time in the future.")
) {}

/** Teaching a class to a Person who already teaches the most classes of its period. */
export class PersonClassLimit extends Schema.TaggedError<
  PersonClassLimit,
  { readonly brand: unique symbol }
>()(
  "PersonClassLimit",
  refusal(
    "PERSON_CLASS_LIMIT",
    "This person already teaches the most classes this period allows."
  )
) {}

/** A subject and cohort name with no letter or digit, which would leave the class without an address. */
export class ClassAddressEmpty extends Schema.TaggedError<
  ClassAddressEmpty,
  { readonly brand: unique symbol }
>()(
  "ClassAddressEmpty",
  refusal(
    "CLASS_ADDRESS_EMPTY",
    "The subject and the cohort name need a letter or a digit for the class address."
  )
) {}

/** A class address that names more than one class of the school, so it names no one class. */
export class ClassAmbiguous extends Schema.TaggedError<
  ClassAmbiguous,
  { readonly brand: unique symbol }
>()(
  "ClassAmbiguous",
  refusal(
    "CLASS_AMBIGUOUS",
    "More than one class of this school has this address."
  )
) {}

/** Assigning a Person who holds no active teacher grant over the class's unit or the whole school. */
export class PersonNotTeacher extends Schema.TaggedError<
  PersonNotTeacher,
  { readonly brand: unique symbol }
>()(
  "PersonNotTeacher",
  refusal(
    "PERSON_NOT_TEACHER",
    "Only a teacher of this unit can teach one of its classes."
  )
) {}

/** Work handed in after the deadline of a task that closes at its deadline. */
export class TaskClosed extends Schema.TaggedError<
  TaskClosed,
  { readonly brand: unique symbol }
>()(
  "TaskClosed",
  refusal("TASK_CLOSED", "This task closed at its deadline.")
) {}

/** A change of a task's points once work is handed in, whose points the students already work toward. */
export class TaskPointsFixed extends Schema.TaggedError<
  TaskPointsFixed,
  { readonly brand: unique symbol }
>()(
  "TaskPointsFixed",
  refusal(
    "TASK_POINTS_FIXED",
    "This task's points are fixed once work is handed in."
  )
) {}

/** Points beyond the points a task is worth. */
export class ScoreOutOfRange extends Schema.TaggedError<
  ScoreOutOfRange,
  { readonly brand: unique symbol }
>()(
  "ScoreOutOfRange",
  refusal("SCORE_OUT_OF_RANGE", "The points are more than this task is worth.")
) {}

/** A library file larger than the library keeps. The file is deleted. */
export class FileSizeRefused extends Schema.TaggedError<
  FileSizeRefused,
  { readonly brand: unique symbol }
>()(
  "FileSizeRefused",
  refusal("FILE_SIZE_REFUSED", "This file is larger than 20 MB.")
) {}

/** A library file whose bytes name no PDF and no image. The file is deleted. */
export class FileTypeRefused extends Schema.TaggedError<
  FileTypeRefused,
  { readonly brand: unique symbol }
>()(
  "FileTypeRefused",
  refusal("FILE_TYPE_REFUSED", "Only a PDF or an image can be added.")
) {}

/** Registering a library upload whose bytes never arrived, or whose reservation the sweep already freed. */
export class UploadMissing extends Schema.TaggedError<
  UploadMissing,
  { readonly brand: unique symbol }
>()(
  "UploadMissing",
  refusal("UPLOAD_MISSING", "This upload did not arrive. Add the file again.")
) {}

/** Moving a folder into itself or into a folder inside it. */
export class FolderCycle extends Schema.TaggedError<
  FolderCycle,
  { readonly brand: unique symbol }
>()(
  "FolderCycle",
  refusal("FOLDER_CYCLE", "A folder cannot move into itself.")
) {}
