import { components } from "@repo/backend/confect/_generated/components";
import type {
  TenantsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import {
  firstActiveUnit,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import type { Seat, SeatKind } from "@repo/backend/confect/exams/seed/contract";
import { assignRole } from "@repo/backend/confect/access/grant";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect } from "effect";

/** One day, how long a seated session lasts: longer than any run of the load test. */
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** The role that a seat's grant gives in the school's first active unit. */
const roleOf = (kind: typeof SeatKind.Type) =>
  kind === "student" ? "student" : "teacher";

/**
 * Seats one signed-in Person: a Better Auth account with a placeholder address, the app
 * profile that the account's creation trigger writes, a session with the seat's token, and
 * a Person of the school claimed by that account, with the seat's grant in the unit.
 */
const seatOne = Effect.fn("exams.seed.seats.one")(function* (seat: {
  readonly kind: typeof SeatKind.Type;
  readonly now: number;
  readonly seat: typeof Seat.Type;
  readonly tenantId: TenantsDoc["_id"];
  readonly unitId: TenantUnitsDoc["_id"];
}) {
  const ctx = yield* MutationCtx;
  const { runMutation } = yield* MutationRunner;
  const data = {
    createdAt: seat.now,
    email: loginAddress(seat.seat.key),
    emailVerified: false,
    name: seat.seat.name,
    updatedAt: seat.now,
  };
  // Better Auth owns these component mutations and their plain Convex references.
  const authUser = yield* Effect.promise(() =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: { data, model: "user" },
    })
  );
  yield* runMutation(refs.internal.auth.lifecycle.onCreate, {
    doc: authUser,
    model: "user",
  }).pipe(Effect.orDie);
  yield* Effect.promise(() =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        data: {
          createdAt: seat.now,
          expiresAt: seat.now + SESSION_LIFETIME_MS,
          token: seat.seat.token,
          updatedAt: seat.now,
          userId: authUser._id,
        },
        model: "session",
      },
    })
  );
  const user = yield* (yield* DatabaseReader)
    .table("users")
    .get("by_authId", authUser._id)
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  const personId = yield* writer
    .table("tenantPeople")
    .insert({
      account: {
        claimedAt: seat.now,
        method: "card",
        state: "claimed",
        userId: user._id,
      },
      kind: "member",
      name: seat.seat.name,
      status: "active",
      tenantId: seat.tenantId,
    })
    .pipe(Effect.orDie);
  const person = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .get(personId)
    .pipe(Effect.orDie);
  yield* assignRole(systemActor, person, roleOf(seat.kind), {
    kind: "unit",
    unitId: seat.unitId,
  }).pipe(Effect.orDie);
});

/**
 * Seats a batch of signed-in Persons for the load test (K26) in a school that `createSchool`
 * opened: each a school account made the way a login card makes one, with a session of the
 * seat's token and a grant in the school's first active unit, a student grant for a student
 * and a teacher grant for a proctor, who may proctor every room of that unit. The test signs
 * each seat's cookie with its token, so no seat needs a sign-in of its own.
 */
export const seedSeats = Effect.fn("exams.seed.seats")(function* (args: {
  readonly kind: typeof SeatKind.Type;
  readonly seats: readonly (typeof Seat.Type)[];
  readonly slug: string;
}) {
  yield* requireAcceptanceSeed();
  const tenant = yield* tenantOf(args.slug);
  const unit = yield* firstActiveUnit(tenant._id);
  const now = yield* Clock.currentTimeMillis;
  yield* Effect.forEach(
    args.seats,
    (seat) =>
      seatOne({
        kind: args.kind,
        now,
        seat,
        tenantId: tenant._id,
        unitId: unit._id,
      }),
    { discard: true }
  );
  return null;
});
