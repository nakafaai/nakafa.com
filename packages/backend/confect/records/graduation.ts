import { Id } from "@repo/backend/confect/_generated/id";
import { Npsn, type UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { isSingleLine } from "@repo/utilities/line";
import { DateTime, Match, Schema } from "effect";

/** A head of school's NIP: the 18 digits of a civil servant's number (Kepmendikdasmen 177/2026, Lampiran I E.3). */
export const Nip = Schema.String.check(Schema.isPattern(/^\d{18}$/u));

/** One line of text a school writes on its letters, from one character to `limit`. */
const lineOf = (limit: number) =>
  Schema.String.check(
    Schema.isTrimmed(),
    isSingleLine,
    Schema.isMinLength(1),
    Schema.isMaxLength(limit)
  );

/** The number of the head's decision on graduation, as the school writes it, such as `421.3/045/SMP.1/2027`. */
export const DecisionNumber = lineOf(80);

/** The place an SKL is issued, the school's town. */
export const IssuePlace = lineOf(80);

/** The head of the school's name as the letters print it, with their degrees. */
export const HeadName = lineOf(120);

/** A calendar date written `YYYY-MM-DD`. The unit's clock decides whether it is a real day. */
export const CivilDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u)
);

/**
 * The head's decision on graduation as the principal records it (SK penetapan kelulusan):
 * its number, the date of graduation, the place of issue, and the head's name and NIP. A head
 * who is not a civil servant has no NIP, and the letters print a dash.
 */
export const GraduationDecision = Schema.Struct({
  date: CivilDate,
  decision: DecisionNumber,
  head: HeadName,
  nip: Schema.optionalKey(Nip),
  place: IssuePlace,
});

/**
 * The graduation of one unit in one period (ADR 0033, S6): the decision, which covers every
 * graduating class group of the unit, and how many SKL it has issued, which numbers the next
 * one. The decision changes only while `issued` is zero.
 */
export const graduationValidator = Schema.Struct({
  ...GraduationDecision.fields,
  createdAt: Schema.Finite,
  decidedBy: Id("tenantPeople"),
  issued: Schema.Int,
  periodId: Id("tenantPeriods"),
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
  updatedAt: Schema.Finite,
});

/** The decision as the graduation page shows it, with how many letters it has issued. */
export const GraduationView = Schema.Struct({
  ...GraduationDecision.fields,
  issued: Schema.Int,
});

/** What the viewer may do on a class group's graduation page, as the server decides. */
export const GraduationAction = Schema.Literals([
  "graduation.decide",
  "graduation.issue",
]);

/**
 * A graduating class group's page: its name and period, its unit with the unit's NPSN, the
 * unit's decision or none yet, the date the rules suggest for one, and what the viewer may do.
 */
export const GraduationOverview = Schema.Struct({
  can: Schema.Array(GraduationAction),
  cohort: Schema.Struct({
    id: Id("tenantCohorts"),
    name: Schema.String,
    period: Schema.String,
    periodId: Id("tenantPeriods"),
  }),
  decision: Schema.NullOr(GraduationView),
  suggested: CivilDate,
  unit: Schema.Struct({ name: Schema.String, npsn: Schema.NullOr(Npsn) }),
});

/** One graduating class group the viewer opens: the class group, its unit, and its period. */
export const GraduationCohort = Schema.Struct({
  id: Id("tenantCohorts"),
  name: Schema.String,
  period: Schema.String,
  unit: Schema.String,
});

/** The month the decision falls in: June for primary education, May for secondary (Lampiran I C.2.d). */
const decisionMonth = (level: typeof UnitLevel.Type) =>
  Match.value(level).pipe(
    Match.whenOr("sma", "ma", "smk", () => 5),
    Match.orElse(() => 6)
  );

/** Days from a weekday to the next Monday, Sunday being 0 as `DateTime` counts it. */
const daysToMonday = (weekDay: number) => (8 - weekDay) % 7;

/**
 * The date Kepmendikdasmen 177/2026 sets for the decision on graduation in a period that ends on
 * `periodEnd`: the first Monday of June of that year for SD, MI, SMP, and MTs, and of May for
 * SMA, MA, and SMK. A holiday moves it to the next working day, which the principal sets, since
 * Nakafa holds no holiday calendar.
 */
export const suggestedDate = (
  level: typeof UnitLevel.Type,
  periodEnd: string
) => {
  const year = Number(periodEnd.slice(0, 4));
  const first = DateTime.makeUnsafe({
    day: 1,
    month: decisionMonth(level),
    year,
  });
  const monday = DateTime.add(first, {
    days: daysToMonday(DateTime.getPartUtc(first, "weekDay")),
  });
  return DateTime.formatIsoDateUtc(monday);
};
