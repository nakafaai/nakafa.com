import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { assignRole } from "@repo/backend/confect/access/grant";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import {
  ADDRESS_INVITE_LIMIT,
  expireInvite,
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/seed.spec";
import { Array as Arr, Effect, Layer, Option } from "effect";

/**
 * Seeds one Teacher of an open school for an acceptance run, as `open` seeds its
 * Owner: an unclaimed Person with an invite to the address, and a teacher grant
 * over the whole school. The account that signs in with the address claims the
 * invite. The journal names the system, as it does for `open`.
 */
const teacher = FunctionImpl.make(
  databaseSchema,
  spec,
  "teacher",
  Effect.fn("tenancy.seed.teacher")(function* ({ email, locale, name, slug }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound();
    }
    const personId = yield* (yield* DatabaseWriter)
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name,
        status: "active",
        tenantId: tenant.value._id,
      })
      .pipe(Effect.orDie);
    const person = yield* reader
      .table("tenantPeople")
      .get(personId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(systemActor, person, {
      type: "person.created",
    });
    const invite = yield* writeInvite(systemActor, person, email, locale);
    yield* assignRole(systemActor, person, "teacher", {
      kind: "tenant",
    }).pipe(Effect.orDie);
    return { invite: invite._id, person: personId };
  })
);

/**
 * Gives the learner who holds the address a student grant in the school's first active
 * unit, so an acceptance run can place the learner in a cohort. The learner must already
 * be a member of the school, because the account that holds the address claims the invite
 * when it signs in, and a missing account or member ends the seed with a defect that names it.
 */
const student = FunctionImpl.make(
  databaseSchema,
  spec,
  "student",
  Effect.fn("tenancy.seed.student")(function* ({ email, slug }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound();
    }
    const unit = yield* reader
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant.value._id).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(unit)) {
      return yield* Effect.die("The school has no active unit.");
    }
    const user = yield* reader
      .table("users")
      .index("by_email", (query) => query.eq("email", email))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(user)) {
      return yield* Effect.die("No account holds this address.");
    }
    const learner = yield* reader
      .table("tenantPeople")
      .index("by_tenantId_and_account_userId", (query) =>
        query
          .eq("tenantId", tenant.value._id)
          .eq("account.userId", user.value._id)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(learner)) {
      return yield* Effect.die("This address is not a member of the school.");
    }
    yield* assignRole(systemActor, learner.value, "student", {
      kind: "unit",
      unitId: unit.value._id,
    }).pipe(Effect.orDie);
    // The learner is over the age limit, so the consent gate leaves an acceptance run's forum open.
    yield* (yield* DatabaseWriter)
      .table("rosterEntries")
      .insert({
        personId: learner.value._id,
        tenantId: tenant.value._id,
        underAgeLimit: false,
      })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Ends the pending invite of the address to the school as its term ending does, the way the
 * sweep expires it (`expireInvite`), so an acceptance run meets an expired invite without
 * waiting the term out. A school that holds no pending invite for the address ends the seed
 * with a defect that names it.
 */
const expired = FunctionImpl.make(
  databaseSchema,
  spec,
  "expired",
  Effect.fn("tenancy.seed.expired")(function* ({ email, slug }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound();
    }
    const invites = yield* reader
      .table("tenantInvites")
      .index("by_tenantId_and_channel_email", (query) =>
        query.eq("tenantId", tenant.value._id).eq("channel.email", email)
      )
      .take(ADDRESS_INVITE_LIMIT)
      .pipe(Effect.orDie);
    const pending = Arr.findFirst(
      invites,
      (invite) => invite.state.status === "pending"
    );
    if (Option.isNone(pending)) {
      return yield* Effect.die(
        "The school holds no pending invite for this address."
      );
    }
    const person = yield* reader
      .table("tenantPeople")
      .get(pending.value.personId)
      .pipe(Effect.orDie);
    yield* expireInvite(pending.value, person);
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(teacher),
  Layer.provide(student),
  Layer.provide(expired),
  GroupImpl.finalize
);
