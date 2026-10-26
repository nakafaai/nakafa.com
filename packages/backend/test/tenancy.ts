import type { GenericId } from "@confect/core";
import { Ref } from "@confect/core";
import { RegisteredConvexFunction } from "@confect/server";
import resendTest from "@convex-dev/resend/test";
import workflowTest from "@convex-dev/workflow/test";
import refs from "@repo/backend/confect/_generated/refs";
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
import {
  type Account,
  type Email,
  INVITE_TERM,
  type InviteState,
  type PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import { MASCOT } from "@repo/backend/test/mascot";
import { seedSchools } from "@repo/backend/test/school";
import type { FunctionReference } from "convex/server";
import type { TestConvex } from "convex-test";
import {
  Array as Arr,
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

/**
 * Adds claimed active members to one school, each with an account of its own, so
 * the school holds more active Persons than one page of a list reads.
 */
export const claimedMembers = Effect.fn("test.tenancy.claimedMembers")(
  function* (tenantId: GenericId.GenericId<"tenants">, count: number) {
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      Arr.makeBy(count, (index) => index),
      (index) =>
        Effect.gen(function* () {
          const userId = yield* writer.table("users").insert({
            authId: `member-${index}`,
            credits: 0,
            creditsResetAt: 0,
            email: `member-${index}@example.com`,
            mascot: MASCOT,
            name: `Member ${index}`,
            plan: "free",
          });
          yield* writer.table("tenantPeople").insert({
            account: {
              claimedAt: TENANCY_NOW,
              method: "invite",
              state: "claimed",
              userId,
            },
            kind: "member",
            name: `Member ${index}`,
            status: "active",
            tenantId,
          });
        }),
      { discard: true }
    );
  }
);

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
 * Calls public functions as one identity and decodes their returns and typed
 * failures through each function's own contract, so tests match errors by tag.
 */
const client = (
  convex: ReturnType<TestConvex<typeof schema>["withIdentity"]>
) => ({
  action: <R extends Ref.AnyPublic & Ref.AnyAction>(
    ref: R,
    args: Ref.Args<R>
  ) =>
    Ref.runWithCodec(
      ref,
      args,
      (reference: FunctionReference<"action", "public">, encoded) =>
        convex.action(reference, encoded)
    ),
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
  const seeded = yield* Effect.promise(() =>
    t.mutation(inMutation((ctx) => seedSchools(ctx, TENANCY_NOW)))
  );
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
    /** Sends one HTTP request to the auth router, as a browser or a client would. */
    fetch: (path: string, init?: RequestInit) => t.fetch(path, init),
    /** Runs the scheduled functions whose time has come. */
    finishScheduled: () =>
      Effect.promise(() => t.finishAllScheduledFunctions(vi.runAllTimers)),
    /**
     * Advances the fake clock by `ms`, then waits for the scheduled functions that came due in
     * that time. A job due later stays pending, so a test can run one job and keep another.
     */
    advanceScheduled: (ms: number) =>
      Effect.promise(async () => {
        vi.advanceTimersByTime(ms);
        await t.finishInProgressScheduledFunctions();
      }),
    /** A client signed in as any session the test made, by the session's ID and its Better Auth user. */
    signedIn: (identity: {
      readonly sessionId: string;
      readonly subject: string;
    }) => client(t.withIdentity(identity)),
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
    /** The convex-test instance, for the storage helpers of `logo.ts`. */
    convex: t,
  });
});

/**
 * Opens a period of the other school with one cohort in it, as that school's Owner, and
 * returns the cohort. The school `nf` reads it as a row of another school.
 */
export const foreignCohort = Effect.fn("test.tenancy.foreignCohort")(function* (
  fixture: Effect.Success<typeof tenancyFixture>
) {
  const other = slugOf("other");
  const period = yield* fixture
    .as("otherOwner")
    .mutation(refs.public.tenancy.periods.create, {
      end: "2026-12-19",
      name: "Ganjil",
      slug: other,
      start: "2026-07-13",
      unitId: fixture.units.sd,
    });
  return yield* fixture
    .as("otherOwner")
    .mutation(refs.public.tenancy.cohorts.create, {
      grade: 7,
      name: "7A",
      periodId: period.id,
      slug: other,
    });
});
