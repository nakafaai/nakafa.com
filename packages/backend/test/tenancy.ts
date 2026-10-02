import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import type { PersonKind } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Schema } from "effect";

export const TENANCY_NOW = Date.UTC(2026, 9, 1, 8);

export const slugOf = Schema.decodeSync(TenantSlug);

const tenantScope = { kind: "tenant" } as const;

/** Inserts one claimed Person. */
export function seedPerson(
  ctx: MutationCtx,
  input: {
    kind?: typeof PersonKind.Type;
    name: string;
    status?: "active" | "suspended" | "removed";
    tenantId: Id<"tenants">;
    userId: Id<"users">;
  }
) {
  return ctx.db.insert("tenantPeople", {
    account: {
      claimedAt: TENANCY_NOW,
      method: "invite",
      state: "claimed",
      userId: input.userId,
    },
    kind: input.kind ?? "member",
    name: input.name,
    status: input.status ?? "active",
    tenantId: input.tenantId,
  });
}

/** Inserts one active standing grant. */
export function seedGrant(
  ctx: MutationCtx,
  input: {
    personId: Id<"tenantPeople">;
    role: BuiltinRole;
    scope: GrantScope;
    tenantId: Id<"tenants">;
  }
) {
  return ctx.db.insert("tenantGrants", {
    grantedBy: { kind: "system" },
    personId: input.personId,
    role: { key: input.role, kind: "builtin" },
    scope: input.scope,
    status: "active",
    tenantId: input.tenantId,
    term: { kind: "standing" },
  });
}

/** Inserts one claimed Person holding one standing grant. */
export async function seedMember(
  ctx: MutationCtx,
  input: {
    name: string;
    role: BuiltinRole;
    scope: GrantScope;
    status?: "active" | "suspended" | "removed";
    tenantId: Id<"tenants">;
    userId: Id<"users">;
  }
) {
  const personId = await seedPerson(ctx, input);
  const grantId = await seedGrant(ctx, { ...input, personId });
  return { grantId, personId };
}

/**
 * Tenant `nf` with units SMP, SMA, and an archived SMK, one Person per role,
 * a suspended Person, an operator-kind Person without grants, and an
 * unclaimed Person; tenant `other` with its own Owner and unit; and an
 * account with no tenant.
 */
export async function createTenancyFixture() {
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(async (ctx) => {
    const account = (suffix: string) =>
      seedAuthenticatedUser(ctx, { now: TENANCY_NOW, suffix });
    const users = {
      admin: await account("admin"),
      auditor: await account("auditor"),
      otherOwner: await account("other-owner"),
      owner: await account("owner"),
      principal: await account("principal"),
      stranger: await account("stranger"),
      student: await account("student"),
      suspended: await account("suspended"),
      teacher: await account("teacher"),
      unitAdmin: await account("unit-admin"),
      visitor: await account("visitor"),
    };
    const nf = await ctx.db.insert("tenants", {
      kind: "foundation",
      name: "Yayasan Nakafa",
      slug: slugOf("nf"),
      status: "active",
    });
    const other = await ctx.db.insert("tenants", {
      kind: "school",
      name: "Sekolah Lain",
      slug: slugOf("other"),
      status: "active",
    });
    const unit = (
      tenantId: Id<"tenants">,
      name: string,
      level: "sd" | "smp" | "sma" | "smk",
      status: "active" | "archived" = "active"
    ) => ctx.db.insert("tenantUnits", { level, name, status, tenantId });
    const units = {
      sd: await unit(other, "SD Lain", "sd"),
      sma: await unit(nf, "SMA Nakafa", "sma"),
      smk: await unit(nf, "SMK Nakafa", "smk", "archived"),
      smp: await unit(nf, "SMP Nakafa", "smp"),
    };
    const smpScope = { kind: "unit", unitId: units.smp } as const;
    const member = (
      name: string,
      userId: Id<"users">,
      role: BuiltinRole,
      scope: GrantScope
    ) => seedMember(ctx, { name, role, scope, tenantId: nf, userId });
    const people = {
      admin: await member("Admin", users.admin.userId, "admin", tenantScope),
      auditor: await member(
        "Auditor",
        users.auditor.userId,
        "auditor",
        tenantScope
      ),
      otherOwner: await seedMember(ctx, {
        name: "Other Owner",
        role: "owner",
        scope: tenantScope,
        tenantId: other,
        userId: users.otherOwner.userId,
      }),
      owner: await member("Owner", users.owner.userId, "owner", tenantScope),
      principal: await member(
        "Principal",
        users.principal.userId,
        "principal",
        { kind: "unit", unitId: units.sma }
      ),
      student: await member(
        "Student",
        users.student.userId,
        "student",
        smpScope
      ),
      suspended: await seedMember(ctx, {
        name: "Suspended",
        role: "teacher",
        scope: smpScope,
        status: "suspended",
        tenantId: nf,
        userId: users.suspended.userId,
      }),
      teacher: await member(
        "Teacher",
        users.teacher.userId,
        "teacher",
        smpScope
      ),
      unitAdmin: await member(
        "Unit Admin",
        users.unitAdmin.userId,
        "admin",
        smpScope
      ),
    };
    const visitor = await seedPerson(ctx, {
      kind: "operator",
      name: "Nakafa Staff",
      tenantId: nf,
      userId: users.visitor.userId,
    });
    const invited = await ctx.db.insert("tenantPeople", {
      account: { state: "unclaimed" },
      kind: "member",
      name: "Invited",
      status: "active",
      tenantId: nf,
    });
    return {
      invited,
      people,
      tenants: { nf, other },
      units,
      users,
      visitor,
    };
  });
  const as = (account: keyof typeof seeded.users) =>
    t.withIdentity({
      sessionId: seeded.users[account].sessionId,
      subject: seeded.users[account].authUserId,
    });
  return { ...seeded, as, t };
}
export type TenancyFixture = Awaited<ReturnType<typeof createTenancyFixture>>;
