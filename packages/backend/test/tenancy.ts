import type { GenericId } from "@confect/core";
import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import type {
  PersonKind,
  PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import type { FunctionReference } from "convex/server";
import type { TestConvex } from "convex-test";
import { Cause, DateTime, Effect, Exit, Schema, Struct } from "effect";

const TENANCY_NOW = DateTime.toEpochMillis(
  DateTime.makeUnsafe("2026-10-01T08:00:00Z")
);

export const slugOf = Schema.decodeSync(TenantSlug);

/** The defect an exit died with, as text, so a test can name the wiring fault it expects. */
export const defectOf = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.hasDies(exit) ? String(Cause.squash(exit.cause)) : "no defect";

/**
 * The principal `RequireMember` provides for one seeded Person: its tenant,
 * the Person, and the Person's active grants.
 */
export const principal = Effect.fn("test.tenancy.principal")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  const reader = yield* DatabaseReader;
  const person = yield* reader
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  return {
    grants: yield* activeGrants(personId),
    person,
    tenant: yield* reader
      .table("tenants")
      .get(person.tenantId)
      .pipe(Effect.orDie),
  };
});

/** Runs a Confect program in one convex-test mutation, the way a Confect mutation runs it. */
const inMutation =
  <A, E>(
    program: (
      ctx: MutationCtx
    ) => Effect.Effect<
      A,
      E,
      RegisteredConvexFunction.MutationServices<typeof databaseSchema>
    >
  ) =>
  (ctx: MutationCtx) =>
    Effect.runPromise(
      program(ctx).pipe(
        Effect.provide(
          RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)
        )
      )
    );

/**
 * Tenant `nf` with units SMP, SMA, and an archived SMK, one Person per role,
 * a suspended Person, an operator-kind Person without grants, and an
 * unclaimed Person; tenant `other` with its own Owner and unit; and an
 * account with no tenant.
 */
const seed = Effect.fn("test.tenancy.seed")(function* (ctx: MutationCtx) {
  const writer = yield* DatabaseWriter;
  const account = Effect.fn("test.tenancy.account")(function* (suffix: string) {
    return yield* Effect.promise(() =>
      seedAuthenticatedUser(ctx, { now: TENANCY_NOW, suffix })
    );
  });
  const users = yield* Effect.all({
    admin: account("admin"),
    auditor: account("auditor"),
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
    kind: "foundation",
    name: "Yayasan Nakafa",
    slug: slugOf("nf"),
    status: "active",
  });
  const other = yield* writer.table("tenants").insert({
    kind: "school",
    name: "Sekolah Lain",
    slug: slugOf("other"),
    status: "active",
  });
  const units = yield* Effect.all({
    sd: writer.table("tenantUnits").insert({
      level: "sd",
      name: "SD Lain",
      status: "active",
      tenantId: other,
    }),
    sma: writer.table("tenantUnits").insert({
      level: "sma",
      name: "SMA Nakafa",
      status: "active",
      tenantId: nf,
    }),
    smk: writer.table("tenantUnits").insert({
      level: "smk",
      name: "SMK Nakafa",
      status: "archived",
      tenantId: nf,
    }),
    smp: writer.table("tenantUnits").insert({
      level: "smp",
      name: "SMP Nakafa",
      status: "active",
      tenantId: nf,
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
        claimedAt: TENANCY_NOW,
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

/**
 * Calls public functions as one identity and decodes their returns and typed
 * failures through each function's own contract, so tests match errors by tag.
 */
const client = (
  convex: ReturnType<TestConvex<typeof schema>["withIdentity"]>
) => ({
  mutation: <R extends Ref.AnyPublicMutation>(ref: R, args: Ref.Args<R>) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"mutation">, encoded) =>
        convex.mutation(reference, encoded)
    ),
  query: <R extends Ref.AnyPublicQuery>(ref: R, args: Ref.Args<R>) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"query">, encoded) =>
        convex.query(reference, encoded)
    ),
});

/** Seeds the tenancy fixture and returns a typed client per seeded account. */
export const tenancyFixture = Effect.gen(function* () {
  const t = createConvexTestWithBetterAuth();
  const seeded = yield* Effect.promise(() => t.mutation(inMutation(seed)));
  return Struct.assign(seeded, {
    anonymous: client(t),
    as: (account: keyof typeof seeded.users) =>
      client(
        t.withIdentity({
          sessionId: seeded.users[account].sessionId,
          subject: seeded.users[account].authUserId,
        })
      ),
    /** Runs a Confect program against the fixture's database, outside any function. */
    run: <A, E>(
      program: Effect.Effect<
        A,
        E,
        RegisteredConvexFunction.MutationServices<typeof databaseSchema>
      >
    ) => Effect.promise(() => t.run(inMutation(() => program))),
  });
});
