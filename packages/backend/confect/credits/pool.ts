import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { latestPersonalGrant } from "@repo/backend/confect/billing/grants";
import { runningSchoolGrants } from "@repo/backend/confect/billing/school";
import { MAX_CREDITS_PER_RESPONSE } from "@repo/backend/confect/credits/constants";
import type { CreditPoolDraw } from "@repo/backend/confect/credits/schema";
import { DEFAULT_NINA_DAILY_CREDITS } from "@repo/backend/confect/tenancy/policy";
import { Array as Arr, DateTime, Effect, Option } from "effect";

/** Credits each student a School grant covers adds to the school's shared Nina pool every month (K46). */
const POOL_CREDITS_PER_SEAT = 100;

/** The most school memberships one member is read through when their pool is found. */
const MAX_MEMBERSHIPS = 50;

/** The month and day (UTC) a reservation at `now` counts against. */
function poolPeriodOf(now: number) {
  const day = DateTime.formatIsoDateUtc(DateTime.makeUnsafe(now));
  return { day, month: day.slice(0, 7) };
}

/**
 * The school pool a member draws Nina credits from (K46): a member whose Pro
 * comes from a school's School grant, not from a grant of their own, draws from
 * that school's shared pool of 100 credits per covered student a month, up to the
 * school's daily cap. A member with a personal Pro grant, and a member of schools
 * whose grants carry no pool (a contract grant), draws from their own allowance.
 */
export const schoolPoolOf = Effect.fn("credits.pool.of")(function* (
  userId: Docs["users"]["_id"],
  now: number
) {
  if (Option.isSome(yield* latestPersonalGrant(userId, now))) {
    return Option.none();
  }
  const reader = yield* DatabaseReader;
  const memberships = yield* reader
    .table("tenantPeople")
    .index("by_account_userId_and_kind_and_status", (query) =>
      query
        .eq("account.userId", userId)
        .eq("kind", "member")
        .eq("status", "active")
    )
    .take(MAX_MEMBERSHIPS)
    .pipe(Effect.orDie);
  for (const membership of memberships) {
    const grants = yield* runningSchoolGrants(membership.tenantId, now);
    const ninaSeats = Arr.reduce(
      grants,
      0,
      (total, grant) => total + grant.ninaSeats
    );
    if (ninaSeats > 0) {
      const tenant = yield* reader
        .table("tenants")
        .get(membership.tenantId)
        .pipe(Effect.orDie);
      return Option.some({
        capacity: ninaSeats * POOL_CREDITS_PER_SEAT,
        dailyCap:
          tenant.policies.ninaDailyCredits ?? DEFAULT_NINA_DAILY_CREDITS,
        tenantId: membership.tenantId,
      });
    }
  }
  return Option.none();
});

/** The school pool a member draws from, with what it holds this month and what the member may draw a day. */
type SchoolPool = Option.Option.Value<
  Effect.Success<ReturnType<typeof schoolPoolOf>>
>;

/** The row of what a school's members drew from its pool in one month, when it exists yet. */
const readPoolMonth = Effect.fn("credits.pool.readMonth")(function* (
  tenantId: Docs["tenants"]["_id"],
  month: string
) {
  return yield* (yield* DatabaseReader)
    .table("creditPools")
    .index("by_tenantId_and_month", (query) =>
      query.eq("tenantId", tenantId).eq("month", month)
    )
    .first()
    .pipe(Effect.orDie);
});

/** The rows a pool reservation counts against: the school's month and the member's day, when they exist yet. */
const readPoolRows = Effect.fn("credits.pool.readRows")(function* (
  draw: typeof CreditPoolDraw.Type,
  userId: Docs["users"]["_id"]
) {
  const month = yield* readPoolMonth(draw.tenantId, draw.month);
  const day = yield* (yield* DatabaseReader)
    .table("creditPoolDays")
    .index("by_tenantId_and_userId_and_day", (query) =>
      query
        .eq("tenantId", draw.tenantId)
        .eq("userId", userId)
        .eq("day", draw.day)
    )
    .first()
    .pipe(Effect.orDie);
  return { day, month };
});

/** What a school's pool holds this month (UTC) for the students its grants cover with Nina, and what its members drew from it so far. */
export const schoolPoolMonthOf = Effect.fn("credits.pool.monthOf")(function* (
  tenantId: Docs["tenants"]["_id"],
  ninaSeats: number,
  now: number
) {
  const month = yield* readPoolMonth(tenantId, poolPeriodOf(now).month);
  return {
    capacity: ninaSeats * POOL_CREDITS_PER_SEAT,
    used: Option.match(month, { onNone: () => 0, onSome: (row) => row.used }),
  };
});

/** What a member and their school drew from the school's pool so far today and this month (UTC). */
export const poolUsageOf = Effect.fn("credits.pool.usageOf")(function* (
  tenantId: Docs["tenants"]["_id"],
  userId: Docs["users"]["_id"],
  now: number
) {
  const draw = { tenantId, ...poolPeriodOf(now) };
  const rows = yield* readPoolRows(draw, userId);
  return {
    day: Option.match(rows.day, { onNone: () => 0, onSome: (row) => row.used }),
    draw,
    month: Option.match(rows.month, {
      onNone: () => 0,
      onSome: (row) => row.used,
    }),
  };
});

/**
 * The credits a member may hold from their school's pool at `now`: what the
 * school's month still holds, and what the member's day still allows, at most one
 * answer's cap. Nothing when either is spent.
 */
export const poolHoldOf = Effect.fn("credits.pool.holdOf")(function* (
  pool: SchoolPool,
  userId: Docs["users"]["_id"],
  now: number
) {
  const usage = yield* poolUsageOf(pool.tenantId, userId, now);
  return {
    credits: Math.max(
      0,
      Math.min(
        MAX_CREDITS_PER_RESPONSE,
        pool.capacity - usage.month,
        pool.dailyCap - usage.day
      )
    ),
    draw: usage.draw,
  };
});

/**
 * Moves what a member drew from their school's pool by `credits`: a reservation
 * draws (a positive amount), and a refund gives back (a negative one), never
 * below nothing. The month's and the day's rows are made on the first draw.
 */
export const movePool = Effect.fn("credits.pool.move")(function* (
  draw: typeof CreditPoolDraw.Type,
  userId: Docs["users"]["_id"],
  credits: number
) {
  const writer = yield* DatabaseWriter;
  const rows = yield* readPoolRows(draw, userId);
  yield* Option.match(rows.month, {
    onNone: () =>
      writer
        .table("creditPools")
        .insert({
          tenantId: draw.tenantId,
          month: draw.month,
          used: Math.max(0, credits),
        })
        .pipe(Effect.asVoid),
    onSome: (row) =>
      writer
        .table("creditPools")
        .patch(row._id, { used: Math.max(0, row.used + credits) }),
  }).pipe(Effect.orDie);
  yield* Option.match(rows.day, {
    onNone: () =>
      writer
        .table("creditPoolDays")
        .insert({
          tenantId: draw.tenantId,
          userId,
          day: draw.day,
          used: Math.max(0, credits),
        })
        .pipe(Effect.asVoid),
    onSome: (row) =>
      writer
        .table("creditPoolDays")
        .patch(row._id, { used: Math.max(0, row.used + credits) }),
  }).pipe(Effect.orDie);
});
