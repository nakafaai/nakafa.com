import type { GenericId } from "@confect/core";
import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import resendTest from "@convex-dev/resend/test";
import workflowTest from "@convex-dev/workflow/test";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import {
  type Account,
  type Email,
  INVITE_TERM,
  type InviteState,
  type PersonKind,
  type PersonStatus,
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
import {
  Cause,
  DateTime,
  Duration,
  Effect,
  Exit,
  Schema,
  Struct,
} from "effect";

export const TENANCY_NOW = DateTime.toEpochMillis(
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

/**
 * Adds a Person to a tenant and an invite that names this address. By default
 * the Person is active and unclaimed and the invite is pending; a test passes
 * the account, the invite state, or the Person's status it needs instead.
 */
export const invitePerson = Effect.fn("test.tenancy.invitePerson")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  address: typeof Email.Type,
  state: {
    account?: typeof Account.Type;
    invite?: typeof InviteState.Type;
    person?: typeof PersonStatus.Type;
  } = {}
) {
  const writer = yield* DatabaseWriter;
  const personId = yield* writer.table("tenantPeople").insert({
    account: state.account ?? { state: "unclaimed" },
    kind: "member",
    name: "Invited Person",
    status: state.person ?? "active",
    tenantId,
  });
  const inviteId = yield* writer.table("tenantInvites").insert({
    channel: { email: address, kind: "email" },
    expiresAt: TENANCY_NOW + Duration.toMillis(INVITE_TERM),
    personId,
    state: state.invite ?? { status: "pending" },
    tenantId,
  });
  return { inviteId, personId };
});

/** Gives one Person a standing grant of one role over a scope, as the school's roster and Admin do. */
export const grantRole = Effect.fn("test.tenancy.grantRole")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  personId: GenericId.GenericId<"tenantPeople">,
  role: BuiltinRole,
  scope: GrantScope
) {
  yield* (yield* DatabaseWriter).table("tenantGrants").insert({
    grantedBy: { kind: "system" },
    personId,
    role: { key: role, kind: "builtin" },
    scope,
    status: "active",
    tenantId,
    term: { kind: "standing" },
  });
});

/** Every journal entry, oldest first. */
export const journal = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("journalEntries").index("by_creation_time").take(50)
);

/** Marks a tenant suspended, the way an operator does. */
export const suspend = Effect.fn("test.tenancy.suspend")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  yield* (yield* DatabaseWriter)
    .table("tenants")
    .patch(tenantId, { status: "suspended" });
});

/** The functions that earlier writes scheduled, as the system table lists them. */
export const scheduledJobs = Effect.gen(function* () {
  const ctx = yield* MutationCtxService;
  return yield* Effect.promise(() =>
    ctx.db.system.query("_scheduled_functions").collect()
  );
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

/**
 * Seeds the tenancy fixture and returns a typed client per seeded account. The
 * workflow and mail components are registered, because opening a tenant starts
 * the delivery of its invitation email.
 */
export const tenancyFixture = Effect.gen(function* () {
  const t = createConvexTestWithBetterAuth();
  resendTest.register(t);
  workflowTest.register(t);
  const seeded = yield* Effect.promise(() => t.mutation(inMutation(seed)));
  return Struct.assign(seeded, {
    /** Seeds one more account with this Better Auth email, verified or not, and a client signed in as it. */
    account: (suffix: string, email: string, emailVerified: boolean) =>
      Effect.promise(async () => {
        const account = await t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            email,
            emailVerified,
            now: TENANCY_NOW,
            suffix,
          })
        );
        return Struct.assign(account, {
          client: client(
            t.withIdentity({
              sessionId: account.sessionId,
              subject: account.authUserId,
            })
          ),
        });
      }),
    anonymous: client(t),
    as: (account: keyof typeof seeded.users) =>
      client(
        t.withIdentity({
          sessionId: seeded.users[account].sessionId,
          subject: seeded.users[account].authUserId,
        })
      ),
    /** Calls internal functions the way the platform and `convex run` do, with no identity. */
    internal: {
      action: <R extends Ref.AnyInternal & Ref.AnyAction>(
        ref: R,
        args: Ref.Args<R>
      ) =>
        Ref.runWithCodec(
          ref,
          args,
          (reference: FunctionReference<"action", "internal">, encoded) =>
            t.action(reference, encoded)
        ),
      mutation: <R extends Ref.AnyInternal & Ref.AnyMutation>(
        ref: R,
        args: Ref.Args<R>
      ) =>
        Ref.runWithCodec(
          ref,
          args,
          (reference: FunctionReference<"mutation", "internal">, encoded) =>
            t.mutation(reference, encoded)
        ),
      query: <R extends Ref.AnyInternal & Ref.AnyQuery>(
        ref: R,
        args: Ref.Args<R>
      ) =>
        Ref.runWithCodec(
          ref,
          args,
          (reference: FunctionReference<"query", "internal">, encoded) =>
            t.query(reference, encoded)
        ),
    },
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
