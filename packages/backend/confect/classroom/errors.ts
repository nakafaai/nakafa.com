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

/** Assigning a Person who holds no active teacher grant over the class's unit or the whole school. */
export class PersonNotTeacher extends Schema.TaggedError<PersonNotTeacher>()(
  "PersonNotTeacher",
  refusal(
    "PERSON_NOT_TEACHER",
    "Only a teacher of this unit can teach one of its classes."
  )
) {}
