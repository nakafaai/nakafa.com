import type { ClassGradesDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  bandOf,
  GradeValue,
  type GradingScheme,
  reachesKktp,
} from "@repo/backend/confect/records/scheme";
import { Option, Schema } from "effect";

/** A grade is a draft until its subject teacher releases it, and a released grade stays on record. */
export const GradeState = Schema.Literals(["draft", "released"]);

/** Whether a grade reaches the KKTP of the scheme that judged it. */
const KktpStatus = Schema.Literals(["reached", "notReached"]);

/**
 * One student's final grade in one class and period. `classId`, `periodId`, and
 * `tenantId` are copied from the class at entry, for indexing and for the locks of
 * its containers. `schemeId` names the stored scheme version that judged the grade,
 * so every grade names one, the built-in version included (records/version.ts).
 * `releasedAt` is set by the release, and both times are epoch milliseconds read
 * from the clock.
 */
export const gradeValidator = Schema.Struct({
  classId: Id("classes"),
  createdAt: Schema.Finite,
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  releasedAt: Schema.optionalKey(Schema.Finite),
  schemeId: Id("gradingSchemes"),
  state: GradeState,
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
  value: GradeValue,
});

/**
 * One grade as the wire shows it. `band` is left out when the scheme has no band
 * that the value reaches, which is every value of a scheme without bands.
 */
export const GradeView = Schema.Struct({
  band: Schema.optionalKey(Schema.String),
  classId: Id("classes"),
  id: Id("classGrades"),
  kktp: KktpStatus,
  personId: Id("tenantPeople"),
  state: GradeState,
  value: GradeValue,
});

/** The wire view of one grade, judged by the scheme that its entry named. */
export const gradeView = (
  grade: Pick<
    ClassGradesDoc,
    "_id" | "classId" | "personId" | "state" | "value"
  >,
  scheme: GradingScheme
): typeof GradeView.Type => {
  const band = bandOf(scheme, grade.value);
  return {
    classId: grade.classId,
    id: grade._id,
    kktp: reachesKktp(scheme, grade.value) ? "reached" : "notReached",
    personId: grade.personId,
    state: grade.state,
    value: grade.value,
    ...(Option.isSome(band) ? { band: band.value.label } : {}),
  };
};
