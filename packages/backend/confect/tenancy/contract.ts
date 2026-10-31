import { Schema } from "effect";

/** The label of one signed document version, such as `2026-10` or `1.0`. */
export const DocumentVersion = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/u)
);

/** The parts of Nakafa School a contract can switch on. */
export const ContractModule = Schema.Literals([
  "classes",
  "exams",
  "bank",
  "grades",
  "reports",
]);

/**
 * The current version of the data processing agreement, the one a school accepts
 * when it opens itself. It is the version label its page at Aksara publishes.
 */
export const DPA_VERSION = "2026-10";

/**
 * What a school signed with Nakafa when it was opened, as the journal records
 * it. The licence covers the whole tenant or one unit, the modules are the
 * parts of Nakafa School the contract switches on, and the two versions name
 * the data processing agreement and the content licence the school accepted.
 */
export const Contract = Schema.Struct({
  contentLicense: DocumentVersion,
  dpaVersion: DocumentVersion,
  modules: Schema.Array(ContractModule).check(
    Schema.isMinLength(1),
    Schema.isUnique()
  ),
  plan: Schema.Literals(["tenant", "unit"]),
});
