import type {
  TenantsDoc,
  TenantUnitsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  firstActiveUnit,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { assignRole } from "@repo/backend/confect/access/grant";
import type { Seat, SeatKind } from "@repo/backend/confect/exams/seed/contract";
import {
  createLoginAccount,
  setLoginPassword,
} from "@repo/backend/confect/identity/account";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect } from "effect";

/**
 * Seats one Person that signs in: a school account made the way a login card
 * makes one, with the seat's token as its password, and a Person of the school
 * claimed by that account, with the seat's grant in the unit.
 */
const seatOne = Effect.fn("exams.seed.seats.one")(function* (seat: {
  readonly kind: typeof SeatKind.Type;
  readonly now: number;
  readonly seat: typeof Seat.Type;
  readonly tenantId: TenantsDoc["_id"];
  readonly unitId: TenantUnitsDoc["_id"];
}) {
  const userId = yield* createLoginAccount(seat.seat.name);
  if ((yield* setLoginPassword(userId, seat.seat.token)) !== null) {
    return yield* Effect.die("A seat's token is not a password Convex Auth takes.");
  }
  const writer = yield* DatabaseWriter;
  const personId = yield* writer
    .table("tenantPeople")
    .insert({
      account: {
        claimedAt: seat.now,
        method: "card",
        state: "claimed",
        userId,
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
  return userId;
});

/**
 * Seats a batch of Persons for the load test (K26) in a school that `createSchool` opened:
 * each a school account made the way a login card makes one, whose password is the seat's
 * token, with a grant in the school's first active unit, a student grant for a student and a
 * teacher grant for a proctor, who may proctor every room of that unit. The test signs each
 * seat in with Convex Auth's password method, its account id and its token, so the
 * answer is each seat's account id, in the order of the seats.
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
  return yield* Effect.forEach(args.seats, (seat) =>
    seatOne({
      kind: args.kind,
      now,
      seat,
      tenantId: tenant._id,
      unitId: unit._id,
    })
  );
});
