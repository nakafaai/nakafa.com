import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A name that another active class of the same cohort already has, compared without case. */
export class ClassNameTaken extends Schema.TaggedError<ClassNameTaken>()(
  "ClassNameTaken",
  refusal(
    "CLASS_NAME_TAKEN",
    "Another active class of this cohort has this name."
  )
) {}

/** A subject that another active class of the cohort already teaches, when a rename gave that class another name. */
export class ClassSubjectTaken extends Schema.TaggedError<ClassSubjectTaken>()(
  "ClassSubjectTaken",
  refusal(
    "CLASS_SUBJECT_TAKEN",
    "Another active class of this cohort already teaches this subject."
  )
) {}

/** A class without a subject outside an SD cohort, where a class names the subject it teaches. */
export class ClassSubjectRequired extends Schema.TaggedError<ClassSubjectRequired>()(
  "ClassSubjectRequired",
  refusal(
    "CLASS_SUBJECT_REQUIRED",
    "Only the homeroom class of an SD cohort may have no subject."
  )
) {}

/** A subject in an SD cohort, which holds only its homeroom class and that class has no subject. */
export class ClassSubjectNotAllowed extends Schema.TaggedError<ClassSubjectNotAllowed>()(
  "ClassSubjectNotAllowed",
  refusal(
    "CLASS_SUBJECT_NOT_ALLOWED",
    "An SD cohort holds only its homeroom class, which has no subject."
  )
) {}

/** Creating a class in a cohort that already holds the most classes it can. */
export class ClassLimit extends Schema.TaggedError<ClassLimit>()(
  "ClassLimit",
  refusal("CLASS_LIMIT", "This cohort holds the most classes it can.")
) {}

/** Teaching a class to a Person who already teaches the most classes of its period. */
export class PersonClassLimit extends Schema.TaggedError<PersonClassLimit>()(
  "PersonClassLimit",
  refusal(
    "PERSON_CLASS_LIMIT",
    "This person already teaches the most classes this period allows."
  )
) {}

/** A subject and cohort name with no letter or digit, which would leave the class without an address. */
export class ClassAddressEmpty extends Schema.TaggedError<ClassAddressEmpty>()(
  "ClassAddressEmpty",
  refusal(
    "CLASS_ADDRESS_EMPTY",
    "The subject and the cohort name need a letter or a digit for the class address."
  )
) {}

/** A class address that names more than one class of the school, so it names no one class. */
export class ClassAmbiguous extends Schema.TaggedError<ClassAmbiguous>()(
  "ClassAmbiguous",
  refusal(
    "CLASS_AMBIGUOUS",
    "More than one class of this school has this address."
  )
) {}

/** Assigning a Person who holds no active teacher grant over the class's unit or the whole school. */
export class PersonNotTeacher extends Schema.TaggedError<PersonNotTeacher>()(
  "PersonNotTeacher",
  refusal(
    "PERSON_NOT_TEACHER",
    "Only a teacher of this unit can teach one of its classes."
  )
) {}

/** Work handed in after the deadline of a task that closes at its deadline. */
export class TaskClosed extends Schema.TaggedError<TaskClosed>()(
  "TaskClosed",
  refusal("TASK_CLOSED", "This task closed at its deadline.")
) {}

/** Points beyond the points a task is worth. */
export class ScoreOutOfRange extends Schema.TaggedError<ScoreOutOfRange>()(
  "ScoreOutOfRange",
  refusal("SCORE_OUT_OF_RANGE", "The points are more than this task is worth.")
) {}

/** A library file larger than the library keeps. The file is deleted. */
export class FileSizeRefused extends Schema.TaggedError<FileSizeRefused>()(
  "FileSizeRefused",
  refusal("FILE_SIZE_REFUSED", "This file is larger than 20 MB.")
) {}

/** A library file whose bytes name no PDF and no image. The file is deleted. */
export class FileTypeRefused extends Schema.TaggedError<FileTypeRefused>()(
  "FileTypeRefused",
  refusal("FILE_TYPE_REFUSED", "Only a PDF or an image can be added.")
) {}
