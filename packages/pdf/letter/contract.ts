import { Schema } from "effect";

/** Everything one SKL PDF shows, in Indonesian (ADR 0033, S6). */
export const LetterInput = Schema.Struct({
  average: Schema.Finite,
  cohort: Schema.String,
  date: Schema.String,
  decision: Schema.String,
  hash: Schema.String,
  head: Schema.String,
  nip: Schema.optionalKey(Schema.String),
  nisn: Schema.String,
  npsn: Schema.String,
  number: Schema.String,
  period: Schema.String,
  place: Schema.String,
  school: Schema.String,
  student: Schema.String,
  subjects: Schema.Array(
    Schema.Struct({ subject: Schema.String, value: Schema.Finite })
  ),
  verifyUrl: Schema.String,
});
