import type { GenericId } from "@confect/core";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import type {
  PersonKind,
  PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { operatorRow } from "@repo/backend/test/operators";
import { Effect, Schema } from "effect";

const slugOf = Schema.decodeSync(TenantSlug);

/**
 * Tenant `nf` with units SMP, SMA, and an archived SMK, one Person per role,
 * a suspended Person, an operator-kind Person without grants, and an
 * unclaimed Person; tenant `other` with its own Owner and unit; and an
 * account with no tenant. Every row that the seed writes carries `now`.
 */
export const seedSchools = Effect.fn("test.tenancy.seed")(function* (
  ctx: MutationCtx,
  now: number
) {
  const writer = yield* DatabaseWriter;
  const account = Effect.fn("test.tenancy.account")(function* (suffix: string) {
    return yield* Effect.promise(() =>
      seedAuthenticatedUser(ctx, { now, suffix })
    );
  });
  const users = yield* Effect.all({
    admin: account("admin"),
    auditor: account("auditor"),
    counselor: account("counselor"),
    deputy: account("deputy"),
    otherOwner: account("other-owner"),
    owner: account("owner"),
    principal: account("principal"),
    stranger: account("stranger"),
    student: account("student"),
    suspended: account("suspended"),
    teacher: account("teacher"),
    unitAdmin: account("unit-admin"),
    visitor: account("visitor"),
  });
  const nf = yield* writer.table("tenants").insert({
    country: "ID",
    currency: "IDR",
    kind: "foundation",
    name: "Yayasan Nakafa",
    policies: NEW_TENANT_POLICIES,
    slug: slugOf("nf"),
    status: "active",
  });
  const other = yield* writer.table("tenants").insert({
    country: "DE",
    currency: "EUR",
    kind: "school",
    name: "Sekolah Lain",
    policies: NEW_TENANT_POLICIES,
    slug: slugOf("other"),
    status: "active",
  });
  const units = yield* Effect.all({
    sd: writer.table("tenantUnits").insert({
      contentLanguage: "de",
      level: "sd",
      name: "SD Lain",
      status: "active",
      tenantId: other,
      timeZone: "Europe/Berlin",
    }),
    sma: writer.table("tenantUnits").insert({
      contentLanguage: "id",
      level: "sma",
      name: "SMA Nakafa",
      status: "active",
      tenantId: nf,
      timeZone: "Asia/Jakarta",
    }),
    smk: writer.table("tenantUnits").insert({
      contentLanguage: "id",
      level: "smk",
      name: "SMK Nakafa",
      status: "archived",
      tenantId: nf,
      timeZone: "Asia/Jakarta",
    }),
    smp: writer.table("tenantUnits").insert({
      contentLanguage: "id",
      level: "smp",
      name: "SMP Nakafa",
      status: "active",
      tenantId: nf,
      timeZone: "Asia/Jakarta",
    }),
  });
  const claimed = Effect.fn("test.tenancy.claimed")(function* (
    tenantId: GenericId.GenericId<"tenants">,
    userId: GenericId.GenericId<"users">,
    name: string,
    kind: typeof PersonKind.Type,
    status: typeof PersonStatus.Type
  ) {
    return yield* writer.table("tenantPeople").insert({
      account: {
        claimedAt: now,
        method: "invite",
        state: "claimed",
        userId,
      },
      kind,
      name,
      status,
      tenantId,
    });
  });
  const member = Effect.fn("test.tenancy.member")(function* (
    tenantId: GenericId.GenericId<"tenants">,
    userId: GenericId.GenericId<"users">,
    name: string,
    role: BuiltinRole,
    scope: GrantScope,
    status: typeof PersonStatus.Type
  ) {
    const personId = yield* claimed(tenantId, userId, name, "member", status);
    const grantId = yield* writer.table("tenantGrants").insert({
      grantedBy: { kind: "system" },
      personId,
      role: { key: role, kind: "builtin" },
      scope,
      status: "active",
      tenantId,
      term: { kind: "standing" },
    });
    return { grantId, personId };
  });
  const tenantWide: GrantScope = { kind: "tenant" };
  const smp: GrantScope = { kind: "unit", unitId: units.smp };
  const people = yield* Effect.all({
    admin: member(
      nf,
      users.admin.userId,
      "Admin",
      "admin",
      tenantWide,
      "active"
    ),
    auditor: member(
      nf,
      users.auditor.userId,
      "Auditor",
      "auditor",
      tenantWide,
      "active"
    ),
    counselor: member(
      nf,
      users.counselor.userId,
      "Counselor",
      "counselor",
      tenantWide,
      "active"
    ),
    deputy: member(nf, users.deputy.userId, "Deputy", "deputy", smp, "active"),
    otherOwner: member(
      other,
      users.otherOwner.userId,
      "Other Owner",
      "owner",
      tenantWide,
      "active"
    ),
    owner: member(
      nf,
      users.owner.userId,
      "Owner",
      "owner",
      tenantWide,
      "active"
    ),
    principal: member(
      nf,
      users.principal.userId,
      "Principal",
      "principal",
      { kind: "unit", unitId: units.sma },
      "active"
    ),
    student: member(
      nf,
      users.student.userId,
      "Student",
      "student",
      smp,
      "active"
    ),
    suspended: member(
      nf,
      users.suspended.userId,
      "Suspended",
      "teacher",
      smp,
      "suspended"
    ),
    teacher: member(
      nf,
      users.teacher.userId,
      "Teacher",
      "teacher",
      smp,
      "active"
    ),
    unitAdmin: member(
      nf,
      users.unitAdmin.userId,
      "Unit Admin",
      "admin",
      smp,
      "active"
    ),
  });
  yield* operatorRow(users.visitor.userId, now);
  const visitor = yield* claimed(
    nf,
    users.visitor.userId,
    "Nakafa Staff",
    "operator",
    "active"
  );
  const invited = yield* writer.table("tenantPeople").insert({
    account: { state: "unclaimed" },
    kind: "member",
    name: "Invited",
    status: "active",
    tenantId: nf,
  });
  return { invited, people, tenants: { nf, other }, units, users, visitor };
});
