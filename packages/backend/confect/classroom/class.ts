import type { ClassesDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * Classes one cohort holds, and classes one Person teaches in one period,
 * archived ones included. Every read of those lists takes at most this many
 * rows, and a class past it is refused, so no read truncates a list.
 */
export const CLASS_LIMIT = 64;

/** The school's own name for a subject, one line, 1 to 80 characters. */
export const ClassSubject = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

/**
 * A class's name, one line, as lists show it: the subject and the cohort name,
 * such as `Fisika X-1`. It is at most 121 characters: 80 for the subject, a
 * space, and the 40 of a cohort name.
 */
export const ClassName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(121)
);

/** A class is active until it is archived, and an archived class stays readable. */
export const ClassStatus = Schema.Literals(["active", "archived"]);

/** The name in the form that uniqueness and order compare: the lowercase name. */
export const classNameKey = (name: string) => name.toLowerCase();

/**
 * The name a class gets at creation: its subject and its cohort name, such as
 * `Fisika X-1`. A class without a subject is the homeroom class of its cohort,
 * so it takes the cohort name alone.
 */
export const classNameOf = (cohortName: string, subject: string | undefined) =>
  subject === undefined ? cohortName : `${subject} ${cohortName}`;

/**
 * The address part of a name: its letters and digits in lowercase, joined by
 * single hyphens, so `Fisika X-1` becomes `fisika-x-1`. Letters of every script
 * stay. The result is empty when the name holds no letter or digit.
 */
export const classSlugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

/**
 * A class of one cohort: one subject taught to one cohort in one period. The
 * tenant, unit, period, and cohort are copied from the cohort at creation, for
 * indexing and for the locks of its containers. `nameKey` is the lowercase name,
 * which the uniqueness check compares. `createdAt` and `updatedAt` are epoch
 * milliseconds read from the clock.
 */
export const classValidator = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  createdAt: Schema.Finite,
  name: ClassName,
  nameKey: Schema.String,
  periodId: Id("tenantPeriods"),
  slug: Schema.String,
  status: ClassStatus,
  subject: Schema.optionalKey(ClassSubject),
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
  updatedAt: Schema.Finite,
});

/**
 * One class as the wire shows it. `subject` is left out for the homeroom class of
 * a cohort, because that key is optional on the row.
 */
export const classView = (row: ClassesDoc) => ({
  cohortId: row.cohortId,
  id: row._id,
  name: row.name,
  periodId: row.periodId,
  slug: row.slug,
  status: row.status,
  ...(row.subject === undefined ? {} : { subject: row.subject }),
});
