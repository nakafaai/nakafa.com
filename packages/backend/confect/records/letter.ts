import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  CivilDate,
  DecisionNumber,
  HeadName,
  IssuePlace,
  Nip,
} from "@repo/backend/confect/records/graduation";
import { ReportHash } from "@repo/backend/confect/records/report";
import { GradeValue } from "@repo/backend/confect/records/scheme";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Npsn, PersonName } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/** One subject of a transcript: its name and its value on the 0 to 100 scale, to two decimals. */
export const TranscriptLine = Schema.Struct({
  subject: Schema.String,
  value: GradeValue,
});

/** A student's transcript data: one line per subject, by name, and the average of their values. */
export const Transcript = Schema.Struct({
  average: GradeValue,
  subjects: Schema.Array(TranscriptLine),
});

/**
 * An SKL is `issued` while its PDF is drawn after the principal issues it, and `locked`
 * once the PDF is stored, as an approved report card is (ADR 0033, S6).
 */
const LetterState = Schema.Literals(["issued", "locked"]);

/**
 * One student's SKL (surat keterangan lulus) from one class group's graduation. It keeps
 * the transcript taken at issue and its number, `{decision}/{001}`, so the PDF and its hash
 * never move when report cards or the roster change later. `hash` is the SHA-256 of the
 * letter's content, which its PDF and the PDF's QR code carry, and `storageId` holds the PDF.
 */
export const letterValidator = Schema.Struct({
  ...Transcript.fields,
  cohortId: Id("tenantCohorts"),
  graduationId: Id("graduations"),
  hash: Schema.String,
  issuedAt: Schema.Finite,
  issuedBy: Id("tenantPeople"),
  lockedAt: Schema.optionalKey(Schema.Finite),
  number: Schema.String,
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  state: LetterState,
  storageId: Schema.optionalKey(Id("_storage")),
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
});

/**
 * The content of an SKL that its hash covers, in a fixed order of keys. The graduation's ID
 * is in it, so the same grades of two students never share a hash, and nobody who knows a
 * student's grades can find the student's hash.
 */
export const LetterContent = Schema.Struct({
  graduationId: Id("graduations"),
  personId: Id("tenantPeople"),
  number: Schema.String,
  decision: DecisionNumber,
  date: CivilDate,
  subjects: Schema.Array(TranscriptLine),
  average: GradeValue,
  issuedAt: Schema.Finite,
});

/** Everything one SKL PDF shows, in Indonesian (ADR 0033, S6). */
export const PrintableLetter = Schema.Struct({
  ...Transcript.fields,
  cohort: Schema.String,
  date: CivilDate,
  decision: DecisionNumber,
  hash: ReportHash,
  head: HeadName,
  locale: AppLocaleCodeSchema,
  nip: Schema.optionalKey(Nip),
  nisn: Nisn,
  npsn: Npsn,
  number: Schema.String,
  period: Schema.String,
  place: IssuePlace,
  school: Schema.String,
  student: PersonName,
  verifyUrl: Schema.String,
});

/**
 * What keeps a student from the e-Ijazah and from an SKL: the unit's NPSN, the unit's
 * decision on graduation, the student's NISN, and a locked report card in the class group.
 */
export const Missing = Schema.Literals(["npsn", "decision", "nisn", "report"]);

/** A student's SKL as the graduation page shows it: its number, its state, its hash, and its PDF once locked. */
export const LetterView = Schema.Struct({
  file: Schema.NullOr(Schema.String),
  hash: Schema.String,
  id: Id("graduationLetters"),
  number: Schema.String,
  state: LetterState,
});

/**
 * One line of a graduating class group: a placed student, their transcript data or none
 * without a locked report card, their SKL or none yet, and what is missing for it.
 */
export const GraduationLine = Schema.Struct({
  hasNisn: Schema.Boolean,
  letter: Schema.NullOr(LetterView),
  missing: Schema.Array(Missing),
  student: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
  transcript: Schema.NullOr(Transcript),
});

/** One row of the e-Ijazah readiness export: a line with the NISN opened, for the school's own file. */
export const ReadinessRow = Schema.Struct({
  ...GraduationLine.fields,
  nisn: Schema.NullOr(Nisn),
});

/** What one call of `issue` did: the letters it issued, the students it left out, and where the next call starts. */
export const IssueResult = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  issued: Schema.Int,
  skipped: Schema.Int,
});
