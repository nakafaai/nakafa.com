import { Id } from "@repo/backend/confect/_generated/id";
import { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import { Duration, Schema } from "effect";

/** How long a link waits for its check: the term of an invite (ADR 0034, GLOSSARY Invite). */
export const LINK_TERM = Duration.days(14);
/** How long one email code lives (ADR 0009). */
export const CODE_TERM = Duration.minutes(5);
/** Wrong tries that void one code (ADR 0009). */
export const CODE_TRIES = 3;

/**
 * The version of the consent rule a consent row was given under. The signed
 * country profile owns the rule (ADR 0032). Until it is signed, this constant
 * stands in for the Indonesian profile, which reads the age limit from UU 35/2014
 * Pasal 1 angka 1, and counsel confirms it before the first school (K20).
 */
export const CONSENT_POLICY_VERSION = "id-profile-pending-1";
const PolicyVersion = Schema.Literal(CONSENT_POLICY_VERSION);

/** Why a link ended: the guardian withdrew consent, the school revoked it, or it expired unverified. */
export const LinkEndReason = Schema.Literals([
  "expired",
  "revoked",
  "withdrawn",
]);

/**
 * A link waits for its check, is verified, or has ended. Only a verified link is
 * the `verifiedParent` relation, and ending one ends the relation at once.
 */
export const LinkState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("pending") }),
  Schema.Struct({ at: Schema.Finite, status: Schema.Literal("verified") }),
  Schema.Struct({
    at: Schema.Finite,
    reason: LinkEndReason,
    status: Schema.Literal("ended"),
  }),
]);
export type LinkState = typeof LinkState.Type;

/**
 * One guardian link: a guardian Person and a student Person of one school. Staff
 * starts it with the guardian's address, and the guardian verifies it. `mismatches`
 * counts the NISN checks that failed, which staff see and the guardian never does.
 */
export const guardianLinkValidator = Schema.Struct({
  email: Email,
  expiresAt: Schema.Finite,
  guardianPersonId: Id("tenantPeople"),
  mismatches: Schema.Finite,
  startedBy: Id("tenantPeople"),
  state: LinkState,
  studentPersonId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/**
 * The one live sign-in code of one address at one school. Only an HMAC of the code
 * is kept, so a reader of the row cannot learn the code (ADR 0009). A new code
 * replaces the row, and a used, voided, or expired code is deleted.
 */
export const guardianCodeValidator = Schema.Struct({
  codeHash: Schema.String,
  email: Email,
  expiresAt: Schema.Finite,
  tenantId: Id("tenants"),
  tries: Schema.Finite,
});

/** How a consent was checked: the email code with the NISN, or a staff member's check. */
export const ConsentMethod = Schema.Literals(["code_nisn", "staff"]);

/**
 * One row of the append-only consent ledger. A withdrawal is a new row. A row holds
 * IDs and codes only, never a name, an address, or free text (ADR 0016, ADR 0034).
 */
export const guardianConsentValidator = Schema.Struct({
  action: Schema.Literals(["granted", "withdrawn"]),
  at: Schema.Finite,
  checker: Id("tenantPeople"),
  guardianPersonId: Id("tenantPeople"),
  linkId: Id("guardianLinks"),
  method: ConsentMethod,
  policyVersion: PolicyVersion,
  studentPersonId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/** The state of a link as a list shows it. An unverified link past its term reads as expired. */
export const LinkStatus = Schema.Literals([
  "pending",
  "verified",
  "expired",
  "revoked",
  "withdrawn",
]);

/** One link as the school's staff list it. */
export const LinkView = Schema.Struct({
  email: Email,
  expiresAt: Schema.Finite,
  guardian: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
  id: Id("guardianLinks"),
  mismatches: Schema.Finite,
  status: LinkStatus,
  student: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
});

/**
 * One child as the guardian sees the link: the child's name and the link's state.
 * A pending link asks for the NISN check, and `staffCheck` says that the school
 * holds no NISN for the child, so staff verifies the link instead.
 */
export const ChildView = Schema.Struct({
  linkId: Id("guardianLinks"),
  staffCheck: Schema.Boolean,
  status: LinkStatus,
  student: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
});

/** The answer of a NISN check: verified, or refused with the same words as a wrong code. */
export const ConfirmOutcome = Schema.Literals(["verified", "refused"]);

/** The answer of a code request. It is the same whether or not the address has a link. */
export const CodeSent = Schema.Struct({ expiresAt: Schema.Finite });

/** What the code sign-in endpoint sends the internal redeem: the school, the address, and the typed code. */
export const CodeRedeem = Schema.Struct({
  code: Schema.String,
  email: Schema.String,
  slug: Schema.String,
});

/** The answer of a redeem: the Better Auth account to sign in, or a refusal with no reason. */
export const RedeemAnswer = Schema.Union([
  Schema.Struct({ authId: Schema.String, outcome: Schema.Literal("signedIn") }),
  Schema.Struct({ outcome: Schema.Literal("refused") }),
]);

/** The NISN checks a link allows before only staff may check it. */
export const NISN_TRIES = 3;

/**
 * One released grade of a child as the guardian reads it: the class's name and
 * the grade's value, band, and KKTP status. Drafts never reach a guardian.
 */
export const ChildGrade = Schema.Struct({
  band: Schema.optionalKey(Schema.String),
  className: Schema.String,
  id: Id("classGrades"),
  kktp: Schema.Literals(["reached", "notReached"]),
  value: Schema.Finite,
});
