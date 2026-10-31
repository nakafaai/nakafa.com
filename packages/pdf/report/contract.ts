import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

/** One subject of a report card: its class, its grade, and how the grade reads. */
const ReportLine = Schema.Struct({
  band: Schema.optionalKey(Schema.String),
  className: Schema.String,
  kktp: Schema.Literals(["reached", "notReached"]),
  value: Schema.Number,
});

/** Everything one report card PDF shows, already in the language of its unit. */
export const ReportInput = Schema.Struct({
  approvedAt: Schema.Finite,
  cohort: Schema.String,
  hash: Schema.String,
  locale: AppLocaleCodeSchema,
  note: Schema.String,
  period: Schema.String,
  school: Schema.String,
  student: Schema.String,
  subjects: Schema.Array(ReportLine),
  verifyUrl: Schema.String,
});
