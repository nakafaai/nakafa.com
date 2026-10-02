import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema, Struct } from "effect";

/** A normalized address: forms trim and lowercase before sending it. */
export const Email = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isTrimmed(),
  Schema.isLowercased(),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
).pipe(Schema.brand("@Nakafa/Email"));
export type Email = typeof Email.Type;

export const TenantName = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(2),
  Schema.isMaxLength(120)
);
export const TenantKind = Schema.Literals(["school", "foundation"]);
/** A suspended tenant stays readable and refuses every write. */
export const TenantStatus = Schema.Literals(["active", "suspended"]);

export const UnitName = Schema.String.check(
  Schema.isTrimmed(),
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
  Schema.isMinLength(1),
  Schema.isMaxLength(120)
);
/** Operator Persons exist only for audited Nakafa staff visits. */
export const PersonKind = Schema.Literals(["member", "operator"]);
/** Operator Persons are suspended between visits; replaced pending Owners are removed. */
export const PersonStatus = Schema.Literals(["active", "suspended", "removed"]);
export const ClaimMethod = Schema.Literals(["invite", "operator"]);

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

export const InviteChannel = Schema.Struct({
  email: Email,
  kind: Schema.Literal("email"),
});
export const InviteState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("pending") }),
  Schema.Struct({
    at: Schema.Finite,
    status: Schema.Literal("accepted"),
    userId: Id("users"),
  }),
  Schema.Struct({ at: Schema.Finite, status: Schema.Literal("revoked") }),
]);

export const tenantValidator = Schema.Struct({
  kind: TenantKind,
  name: TenantName,
  slug: TenantSlug,
  status: TenantStatus,
});
/**
 * A tenant's public identity, shown before anyone signs in. Only these fields
 * leave the server, so tenant fields added later stay private.
 */
export const TenantProfile = tenantValidator.mapFields(
  Struct.pick(["kind", "name", "slug", "status"])
);
/** Projects a stored tenant onto its public profile, with exactly the profile's fields. */
export const tenantProfile = (tenant: typeof tenantValidator.Type) =>
  Struct.pick(tenant, Struct.keys(TenantProfile.fields));
export const tenantUnitValidator = Schema.Struct({
  level: UnitLevel,
  name: UnitName,
  npsn: Schema.optionalKey(Npsn),
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
export const tenantInviteValidator = Schema.Struct({
  channel: InviteChannel,
  personId: Id("tenantPeople"),
  state: InviteState,
  tenantId: Id("tenants"),
});
