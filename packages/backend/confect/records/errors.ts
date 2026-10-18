import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A student who is not placed in the class's cohort in the class's period, so the class cannot grade them. */
export class GradeNotPlaced extends Schema.TaggedError<GradeNotPlaced>()(
  "GradeNotPlaced",
  refusal(
    "GRADE_NOT_PLACED",
    "This student is not placed in the cohort of this class."
  )
) {}

/** A grade that is already released, which no entry may change. */
export class GradeReleased extends Schema.TaggedError<GradeReleased>()(
  "GradeReleased",
  refusal("GRADE_RELEASED", "This grade is already released.")
) {}
