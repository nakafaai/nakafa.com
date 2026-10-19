import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id } from "@repo/backend/confect/_generated/id";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Currency, TimeZone } from "@repo/backend/confect/tenancy/locale";
import { TenantPolicies } from "@repo/backend/confect/tenancy/policy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { MascotCode } from "@repo/mascot/code";
import { isSingleLine } from "@repo/utilities/line";
import { Duration, Schema, Struct } from "effect";

/** A normalized address: forms trim and lowercase before sending it. */
export const Email = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isTrimmed(),
  Schema.isLowercased(),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
).pipe(Schema.brand("@Nakafa/Email"));

/**
 * Names are one line: they fill list rows, and the organisation's name is put
 * in the subject of its invitation email, where a line break would end the
 * header.
 */
export const TenantName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(2),
  Schema.isMaxLength(120)
);
export const TenantKind = Schema.Literals(["school", "foundation"]);
/** A suspended tenant stays readable and refuses every write. */
export const TenantStatus = Schema.Literals(["active", "suspended"]);

export const UnitName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);
export const UnitLevel = Schema.Literals([
  "paud",
  "sd",
  "mi",
  "smp",
  "mts",
  "sma",
  "ma",
  "smk",
  "slb",
  "other",
]);
/** An archived unit stays readable and refuses every write. */
export const UnitStatus = Schema.Literals(["active", "archived"]);
/** Units one tenant may hold; every unit list reads at most this many. */
export const UNIT_LIMIT = 24;
/** The national school number (NPSN) of one unit. */
export const Npsn = Schema.String.check(Schema.isPattern(/^\d{8}$/)).pipe(
  Schema.brand("@Nakafa/Npsn")
);

export const PersonName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(120)
);
/** Operator Persons exist only for audited Nakafa staff visits. */
export const PersonKind = Schema.Literals(["member", "operator"]);
/** Operator Persons are suspended between visits; replaced pending Owners are removed. */
export const PersonStatus = Schema.Literals(["active", "suspended", "removed"]);
/**
 * How an account came to hold a Person: an invite, a login card, operator work,
 * or founding the school itself.
 */
export const ClaimMethod = Schema.Literals([
  "card",
  "invite",
  "operator",
  "founder",
]);
/**
 * Why an operator changed a Person without the school's own action.
 * `break-glass` removes an unclaimed Owner and invites a replacement.
 */
export const PersonReason = Schema.Literals(["break-glass"]);
/**
 * The roles that one invite gives at once: a teacher, or an Admin, whom only an
 * Owner may name (`authorizeOwnerRole`).
 */
export const InvitedRole = BuiltinRole.pick(["admin", "teacher"]);

/** Binds a Person to at most one Nakafa account. */
export const Account = Schema.Union([
  Schema.Struct({ state: Schema.Literal("unclaimed") }),
  Schema.Struct({
    claimedAt: Schema.Finite,
    method: ClaimMethod,
    state: Schema.Literal("claimed"),
    userId: Id("users"),
  }),
]);

const InviteChannel = Schema.Struct({
  email: Email,
  kind: Schema.Literal("email"),
});
/**
 * An invite waits until it is claimed, revoked, or expired. When its account is
 * deleted, its accepted invite is revoked, so no invite names a deleted account.
 */
export const InviteState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("pending") }),
  Schema.Struct({
    at: Schema.Finite,
    status: Schema.Literal("accepted"),
    userId: Id("users"),
  }),
  Schema.Struct({ at: Schema.Finite, status: Schema.Literal("expired") }),
  Schema.Struct({ at: Schema.Finite, status: Schema.Literal("revoked") }),
]);

/** A logo is a PNG or an SVG image. The arguments that set one name this type. */
export const LogoType = Schema.Literals(["image/png", "image/svg+xml"]);
/** The most bytes a logo may hold: one megabyte. */
export const LOGO_BYTE_LIMIT = 1_048_576;
/** `set` answers with the address of the file that now shows as the school's logo. */
export const LogoSet = Schema.TaggedStruct("LogoSet", {
  logo: Schema.String,
});
/**
 * `set` answers this, and changes nothing else, when the file is over the logo
 * limit: `size` names the reason. The file is deleted, so the answer is a value
 * and not a failure, because a failed mutation rolls its writes back.
 */
export const LogoRefused = Schema.TaggedStruct("LogoRefused", {
  reason: Schema.Literal("size"),
});
/** The answer of `set`: a logo that is set, or a file that is refused. */
export const LogoAnswer = Schema.Union([LogoSet, LogoRefused]);

/**
 * The organisation holds its country and the currency of its contract (ADR
 * 0032), and the choices its Owner makes for the whole tenant. The country is
 * checked for its shape only, two uppercase letters: which countries Nakafa
 * serves is the decision of the signed country profile, so no list of
 * countries is kept in code.
 */
export const tenantValidator = Schema.Struct({
  country: CountryCodeSchema,
  currency: Currency,
  kind: TenantKind,
  logo: Schema.optionalKey(Id("_storage")),
  name: TenantName,
  policies: TenantPolicies,
  slug: TenantSlug,
  status: TenantStatus,
});
/**
 * A tenant's public identity, shown before anyone signs in: its kind, name,
 * address and status, its animal, and the address of its logo when it has one.
 * Only these fields leave the server, so tenant fields added later stay private.
 */
export const TenantProfile = Schema.Struct({
  ...Struct.pick(tenantValidator.fields, ["kind", "name", "slug", "status"]),
  logo: Schema.optionalKey(Schema.String),
  mascot: MascotCode,
});
/**
 * The caller's account as its school shows it: its name, its animal, and its
 * username when it has one. Its photo is in the view only while the account
 * shows it, which `photoOf` decides (`confect/users/picture.ts`).
 */
export const ViewerAccount = Schema.Struct({
  image: Schema.optionalKey(Schema.String),
  mascot: MascotCode,
  name: Schema.String,
  username: Schema.optionalKey(Schema.String),
});
/** What an Owner sets for the whole tenant; every member sees it. */
export const TenantSettings = tenantValidator.mapFields(
  Struct.pick(["country", "currency", "policies"])
);
/** Projects a stored tenant onto its settings, with exactly the settings' fields. */
export const tenantSettings = (tenant: typeof tenantValidator.Type) =>
  Struct.pick(tenant, Struct.keys(TenantSettings.fields));
/**
 * The fields of a unit that its school sets: the language of its content and
 * the time zone of its clocks. The language of the interface is not stored; it
 * follows the learner's `NEXT_LOCALE` cookie (ADR 0032).
 */
export const unitFields = {
  contentLanguage: AppLocaleCodeSchema,
  level: UnitLevel,
  name: UnitName,
  npsn: Schema.optionalKey(Npsn),
  timeZone: TimeZone,
};
export const tenantUnitValidator = Schema.Struct({
  ...unitFields,
  status: UnitStatus,
  tenantId: Id("tenants"),
});
/**
 * A Person holds identity fields only. Roster details (national IDs, birth
 * dates) live in their own tables, because every School function loads this
 * document and every change reruns the holder's subscriptions.
 */
export const tenantPersonValidator = Schema.Struct({
  account: Account,
  kind: PersonKind,
  name: PersonName,
  status: PersonStatus,
  tenantId: Id("tenants"),
});
/** How long an invite waits to be claimed, counted from the moment it is written. */
export const INVITE_TERM = Duration.days(14);

/**
 * An invite names a Person and an address. `expiresAt` is fixed when the
 * invite is written: a resend sends the same invite again and never moves it.
 */
export const tenantInviteValidator = Schema.Struct({
  channel: InviteChannel,
  expiresAt: Schema.Finite,
  personId: Id("tenantPeople"),
  state: InviteState,
  tenantId: Id("tenants"),
});
