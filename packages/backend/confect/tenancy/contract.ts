import { Schema } from "effect";

/** The label of one signed document version, such as `2026-10` or `1.0`. */
const DocumentVersion = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u)
);

/**
 * What a school signed with Nakafa when it was opened, as the journal records
 * it. The licence covers the whole tenant or one unit, the modules are the
 * parts of Nakafa School the contract switches on, and the two versions name
 * the data processing agreement and the content licence the school accepted.
 */
export const Contract = Schema.Struct({
  contentLicense: DocumentVersion,
  dpaVersion: DocumentVersion,
  modules: Schema.Array(
    Schema.Literals(["classes", "exams", "bank", "grades", "reports"])
  ).check(Schema.isMinLength(1), Schema.isUnique()),
  plan: Schema.Literals(["tenant", "unit"]),
});
