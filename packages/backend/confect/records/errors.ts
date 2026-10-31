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

/** A scheme version that does not take effect after the school's newest one, so it would never be in force. */
export class SchemeNotLater extends Schema.TaggedError<SchemeNotLater>()(
  "SchemeNotLater",
  refusal(
    "SCHEME_NOT_LATER",
    "A new grading scheme must take effect after the newest one."
  )
) {}

/** A student who is not placed in the cohort in its period, so the cohort holds no report for them. */
export class ReportNotPlaced extends Schema.TaggedError<ReportNotPlaced>()(
  "ReportNotPlaced",
  refusal(
    "REPORT_NOT_PLACED",
    "This student is not placed in this class group."
  )
) {}

/** A report card past the step the change needs: written only as a draft, handed in once, approved once. */
export class ReportClosed extends Schema.TaggedError<ReportClosed>()(
  "ReportClosed",
  refusal("REPORT_CLOSED", "This report card has moved on from that step.")
) {}

/** A class group outside its unit's last grade, or a unit without one, which has no graduation (ADR 0033, S6). */
export class GraduationNotFinal extends Schema.TaggedError<GraduationNotFinal>()(
  "GraduationNotFinal",
  refusal("GRADUATION_NOT_FINAL", "Only the last grade of a unit graduates.")
) {}

/** A decision on graduation that has issued letters, which keep its number and date. */
export class GraduationIssued extends Schema.TaggedError<GraduationIssued>()(
  "GraduationIssued",
  refusal(
    "GRADUATION_ISSUED",
    "This decision has issued letters, so it no longer changes."
  )
) {}

/** A date of graduation that is not a day of the unit's calendar. */
export class GraduationDateInvalid extends Schema.TaggedError<GraduationDateInvalid>()(
  "GraduationDateInvalid",
  refusal("GRADUATION_DATE_INVALID", "This date is not a day of the calendar.")
) {}

/** An issue of letters before the principal recorded the decision on graduation. */
export class GraduationUndecided extends Schema.TaggedError<GraduationUndecided>()(
  "GraduationUndecided",
  refusal(
    "GRADUATION_UNDECIDED",
    "Record the decision on graduation before issuing letters."
  )
) {}
