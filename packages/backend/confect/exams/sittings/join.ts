import type { GenericId } from "@confect/core";
import type {
  ExamSittingsDoc,
  TenantGrantsDoc,
  TenantPeopleDoc,
  TenantsDoc,
  UsersDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { assignRole } from "@repo/backend/confect/access/grant";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { googleHostedDomains } from "@repo/backend/confect/auth/tokens";
import { ensureStudentSeat } from "@repo/backend/confect/billing/seats";
import {
  sittingAuthority,
  withExam,
} from "@repo/backend/confect/exams/sittings/authority";
import type {
  JoinOutcome,
  JoinRefusal,
} from "@repo/backend/confect/exams/sittings/contract";
import {
  mayEnter,
  sittingLocked,
} from "@repo/backend/confect/exams/sittings/eligibility";
import { readSitting } from "@repo/backend/confect/exams/sittings/held";
import {
  accountMayFail,
  countFailedJoin,
} from "@repo/backend/confect/exams/sittings/rate";
import {
  normalizeToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import { personActor, systemActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAuthority,
  placementOf,
} from "@repo/backend/confect/tenancy/authority";
import {
  bindPerson,
  type ClaimedAccount,
} from "@repo/backend/confect/tenancy/claim";
import {
  accountPersonName,
  createPerson,
} from "@repo/backend/confect/tenancy/create";
import { graduationOf } from "@repo/backend/confect/tenancy/graduate";
import {
  admitsAddress,
  admitsHostedDomains,
} from "@repo/backend/confect/tenancy/policy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { matchesSecret } from "@repo/utilities/digest";
import { Array as Arr, Clock, Effect, Option, Struct } from "effect";

/**
 * The open rooms of one school that a code typed without its room is checked against. A school
 * runs far fewer rooms at once; a code for a room past this bound is refused as a wrong one.
 */
const OPEN_ROOM_SCAN = 256;

/** The reply to a room's code. */
type JoinReply = typeof JoinOutcome.Type;

const refused = (reason: typeof JoinRefusal.Type): JoinReply => ({
  outcome: "refused",
  reason,
});

const joined = (sitting: ExamSittingsDoc): JoinReply => ({
  outcome: "joined",
  sittingId: sitting._id,
});

/** The rooms a code may open: the room the student scanned, or every open room of the school. */
const candidateRooms = Effect.fn("exams.sittings.join.candidates")(function* (
  tenantId: TenantsDoc["_id"],
  sittingId: Option.Option<ExamSittingsDoc["_id"]>
) {
  if (Option.isSome(sittingId)) {
    return Option.toArray(yield* readSitting(sittingId.value, tenantId));
  }
  return yield* (yield* DatabaseReader)
    .table("examSittings")
    .index("by_tenantId_and_state_and_opensAt", (query) =>
      query.eq("tenantId", tenantId).eq("state", "open")
    )
    .take(OPEN_ROOM_SCAN)
    .pipe(Effect.orDie);
});

/**
 * The room whose current token the code is. Each room's hash is bound to its own row, so the code
 * is hashed once for each room it is checked against, and a code the proctor has changed opens none.
 */
const roomOf = Effect.fn("exams.sittings.join.room")(function* (
  tenantId: TenantsDoc["_id"],
  sittingId: Option.Option<ExamSittingsDoc["_id"]>,
  token: string
) {
  const keys = yield* readTenantKeys(tenantId).pipe(Effect.orDie);
  return yield* Effect.findFirst(
    yield* candidateRooms(tenantId, sittingId),
    (sitting) =>
      tokenHash(keys, sitting._id, token).pipe(
        Effect.flatMap((hash) => matchesSecret(hash, sitting.tokenHash)),
        Effect.orDie
      )
  );
});

/**
 * Whether the school admits the account by its email domains (ADR 0009), as an invite's claim
 * decides it: every account while the school lists none, and otherwise only an account whose
 * address and Google sign-ins are of a listed domain.
 */
const admitsAccount = Effect.fn("exams.sittings.join.admits")(function* (
  tenant: TenantsDoc,
  user: UsersDoc,
  authId: string
) {
  if (Arr.isReadonlyArrayEmpty(tenant.policies.emailDomains)) {
    return true;
  }
  return (
    admitsAddress(tenant.policies, user.email) &&
    admitsHostedDomains(tenant.policies, yield* googleHostedDomains(authId))
  );
});

/** Whether the school on the free plan still holds a student seat for one more student. */
const seatLeft = (tenantId: TenantsDoc["_id"]) =>
  ensureStudentSeat(tenantId).pipe(
    Effect.as(true),
    Effect.catchTag("GrantRejected", () => Effect.succeed(false))
  );

/**
 * A new member Person of the school, claimed by the account at once, and journaled as made and
 * claimed by the system, as an invite's claim is.
 */
const claimPerson = Effect.fn("exams.sittings.join.claim")(function* (
  tenantId: TenantsDoc["_id"],
  user: UsersDoc
) {
  const person = yield* createPerson(
    systemActor,
    tenantId,
    accountPersonName(user)
  );
  const account: ClaimedAccount = {
    claimedAt: yield* Clock.currentTimeMillis,
    method: "room",
    state: "claimed",
    userId: user._id,
  };
  yield* bindPerson(person, account);
  yield* personAuthority.record(systemActor, person, {
    method: "room",
    type: "person.claimed",
  });
  return Struct.assign(person, { account });
});

/** Places a student in the cohort of a cohort room, journaled under the student. */
const placeInCohort = Effect.fn("exams.sittings.join.place")(function* (
  person: TenantPeopleDoc,
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const cohort = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .get(cohortId)
    .pipe(Effect.orDie);
  yield* (yield* DatabaseWriter)
    .table("tenantCohortMembers")
    .insert({
      cohortId,
      periodId: cohort.periodId,
      personId: person._id,
      tenantId: cohort.tenantId,
    })
    .pipe(Effect.orDie);
  yield* personAuthority.record(personActor(person), person, {
    cohort: cohortId,
    type: "person.placed",
  });
});

/**
 * Makes the Person a student of the room: a student grant over its unit, which takes a seat when
 * the Person holds none yet, a place in its cohort for a cohort room, and the room's journal entry
 * of the join, all under the student. The caller has checked the seat and the cohort.
 */
const admitStudent = Effect.fn("exams.sittings.join.admit")(function* (
  person: TenantPeopleDoc,
  sitting: ExamSittingsDoc
) {
  const actor = personActor(person);
  yield* assignRole(actor, person, "student", {
    kind: "unit",
    unitId: sitting.unitId,
  }).pipe(Effect.orDie);
  if (sitting.cohortId !== null) {
    yield* placeInCohort(person, sitting.cohortId);
  }
  yield* sittingAuthority.record(actor, yield* withExam(sitting), {
    person: person._id,
    type: "sitting.join",
  });
  return joined(sitting);
});

/** Whether a member Person may not become a student of the room by its code. */
const refusesMember = Effect.fn("exams.sittings.join.refuses")(function* (
  person: TenantPeopleDoc,
  grants: readonly TenantGrantsDoc[],
  sitting: ExamSittingsDoc
) {
  // Staff never become students by a code, so a proctor who tries the room's own code stays staff.
  if (Arr.some(grants, (grant) => grant.role.key !== "student")) {
    return true;
  }
  if (Option.isSome(yield* graduationOf(sitting.unitId, person._id))) {
    return true;
  }
  if (sitting.cohortId === null) {
    return false;
  }
  const cohort = yield* (yield* DatabaseReader)
    .table("tenantCohorts")
    .get(sitting.cohortId)
    .pipe(Effect.orDie);
  // A student placed in another class of the period stays in it.
  return Option.isSome(yield* placementOf(cohort.periodId, person._id));
});

/**
 * Lets an account that is a member of the school into the room: a student who may already enter
 * it joins without a write, and a student of another unit or class becomes one of the room's.
 * A removed Person, an operator, and staff are refused.
 */
const joinAsMember = Effect.fn("exams.sittings.join.member")(function* (
  tenant: TenantsDoc,
  person: TenantPeopleDoc,
  sitting: ExamSittingsDoc
) {
  if (person.kind !== "member" || person.status !== "active") {
    return refused("NotAdmitted");
  }
  const grants = yield* activeGrants(person._id);
  if (yield* mayEnter(sitting, { grants, person, tenant })) {
    return joined(sitting);
  }
  if (yield* refusesMember(person, grants, sitting)) {
    return refused("NotAdmitted");
  }
  const studies = Arr.some(grants, (grant) => grant.role.key === "student");
  if (!(studies || (yield* seatLeft(tenant._id)))) {
    return refused("SeatLimit");
  }
  return yield* admitStudent(person, sitting);
});

/**
 * Lets an account with no Person in the school into the room: the school's email domains must
 * admit it and a student seat must be left, both checked before any write, and then the account
 * claims a new Person that becomes a student of the room.
 */
const joinAsNewcomer = Effect.fn("exams.sittings.join.newcomer")(function* (
  tenant: TenantsDoc,
  account: { readonly appUser: UsersDoc; readonly authId: string },
  sitting: ExamSittingsDoc
) {
  if (!(yield* admitsAccount(tenant, account.appUser, account.authId))) {
    return refused("NotAdmitted");
  }
  if (!(yield* seatLeft(tenant._id))) {
    return refused("SeatLimit");
  }
  const person = yield* claimPerson(tenant._id, account.appUser);
  return yield* admitStudent(person, sitting);
});

/**
 * Joins the signed-in account to an open room of the school by the room's code, the one the
 * proctor's view shows now: the room the student scanned, or, for a code typed alone, the open
 * room of the school that holds it. The account becomes a student of the room's unit, and of its
 * cohort for a cohort room, and the student then enters with the same code. A wrong code counts
 * one failed try of the account in the school, and five a minute stop it. Every refusal is a
 * value, so a counted try stays in the database.
 */
export const joinRoom = Effect.fn("exams.sittings.join")(function* (args: {
  readonly sittingId?: ExamSittingsDoc["_id"];
  readonly slug: TenantSlug;
  readonly token: string;
}) {
  const account = yield* requireAuth();
  const tenant = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", args.slug))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(tenant)) {
    return refused("NotAdmitted");
  }
  const tenantId = tenant.value._id;
  const userId = account.appUser._id;
  if (!(yield* accountMayFail(tenantId, userId))) {
    return refused("TooManyTries");
  }
  const room = yield* roomOf(
    tenantId,
    Option.fromNullishOr(args.sittingId),
    normalizeToken(args.token)
  );
  if (Option.isNone(room)) {
    yield* countFailedJoin(tenantId, userId);
    return refused("TokenRefused");
  }
  const sitting = room.value;
  if (sitting.state !== "open" || (yield* sittingLocked(sitting))) {
    return refused("SittingNotOpen");
  }
  const held = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get("by_tenantId_and_account_userId", tenantId, userId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  return Option.isSome(held)
    ? yield* joinAsMember(tenant.value, held.value, sitting)
    : yield* joinAsNewcomer(tenant.value, account, sitting);
});
