import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { GradeValue } from "@repo/backend/confect/records/scheme";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * A report card is a draft while its homeroom teacher writes it, `completed` once
 * they hand it in, `approved` while its PDF is drawn after the principal's approval,
 * and `locked` once the PDF and its hash are stored (ADR 0033, S4 and S5).
 */
const ReportState = Schema.Literals([
  "draft",
  "completed",
  "approved",
  "locked",
]);

/** The most characters of a homeroom teacher's note. */
export const NOTE_LIMIT = 1000;

/** The homeroom teacher's note on a report card. */
export const ReportNote = Schema.String.check(Schema.isMaxLength(NOTE_LIMIT));

/** One subject line of a report: the class, its released grade, and how the scheme judged it. */
export const ReportSubject = Schema.Struct({
  band: Schema.optionalKey(Schema.String),
  className: Schema.String,
  kktp: Schema.Literals(["reached", "notReached"]),
  value: GradeValue,
});

/**
 * One student's report card for one cohort of one period. `subjects` is the copy of
 * the released grades taken at approval, so a locked report keeps its values when the
 * grade rows go with the period. `hash` is the SHA-256 of the report's content, which
 * its PDF and the PDF's QR code carry, and `storageId` holds the PDF.
 */
export const reportCardValidator = Schema.Struct({
  approvedAt: Schema.optionalKey(Schema.Finite),
  approvedBy: Schema.optionalKey(Id("tenantPeople")),
  cohortId: Id("tenantCohorts"),
  completedAt: Schema.optionalKey(Schema.Finite),
  createdAt: Schema.Finite,
  hash: Schema.optionalKey(Schema.String),
  lockedAt: Schema.optionalKey(Schema.Finite),
  note: ReportNote,
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  state: ReportState,
  storageId: Schema.optionalKey(Id("_storage")),
  subjects: Schema.optionalKey(Schema.Array(ReportSubject)),
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/** One report card as its readers see it, before its subject lines. */
export const ReportView = Schema.Struct({
  approvedAt: Schema.NullOr(Schema.Finite),
  hash: Schema.NullOr(Schema.String),
  id: Id("reportCards"),
  note: ReportNote,
  state: ReportState,
});

/** What the viewer may do with one line of a cohort's report list. */
export const ReportAction = Schema.Literals([
  "report.approve",
  "report.complete",
  "report.write",
]);

/**
 * One line of a cohort's report list: a placed student, their report card or none yet,
 * and what the viewer may do with it, as the server decides.
 */
export const ReportLine = Schema.Struct({
  can: Schema.Array(ReportAction),
  report: Schema.NullOr(ReportView),
  student: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
});

/**
 * A report card with its subject lines: the released grades of the student's classes
 * in the cohort until approval, and the copy taken at approval after it. A locked
 * report also gives the address of its PDF.
 */
export const ReportDetail = Schema.Struct({
  ...ReportView.fields,
  file: Schema.NullOr(Schema.String),
  student: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
  subjects: Schema.Array(ReportSubject),
});

/**
 * The answer of the public check of a report's hash: the facts the QR may reveal, and
 * no student's name and no grade (ADR 0033). An unknown hash gets one answer.
 */
export const VerifyAnswer = Schema.Union([
  Schema.Struct({
    approvedAt: Schema.Finite,
    kind: Schema.Literal("report"),
    outcome: Schema.Literal("locked"),
    period: Schema.String,
    school: Schema.String,
  }),
  Schema.Struct({ outcome: Schema.Literal("unknown") }),
]);

/** A report hash as the verification address carries it: 64 lowercase hex digits. */
export const ReportHash = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{64}$/)
);

/** Everything one report PDF shows: the copy taken at approval, and the hash and link its QR carries. */
export const PrintableReport = Schema.Struct({
  approvedAt: Schema.Finite,
  cohort: Schema.String,
  hash: ReportHash,
  locale: AppLocaleCodeSchema,
  note: ReportNote,
  period: Schema.String,
  school: Schema.String,
  student: Schema.String,
  subjects: Schema.Array(ReportSubject),
  verifyUrl: Schema.String,
});

/** The content of a report that its hash covers, in a fixed order of keys. */
export const HashContent = Schema.Struct({
  id: Id("reportCards"),
  personId: Id("tenantPeople"),
  subjects: Schema.Array(ReportSubject),
  note: ReportNote,
  approvedAt: Schema.Finite,
});

/** One class group whose report cards the viewer opens, in an active period. */
export const ReportCohort = Schema.Struct({
  id: Id("tenantCohorts"),
  name: Schema.String,
  period: Schema.String,
});
