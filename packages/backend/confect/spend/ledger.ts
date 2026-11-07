import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  CREDIT_UNIT_MICRO_USD,
  getPlanCreditConfig,
  MAX_CREDIT_LOTS,
} from "@repo/backend/confect/credits/constants";
import { schoolCreditsOf } from "@repo/backend/confect/credits/pool";
import {
  type Vendor,
  vendorOf,
  type Work,
} from "@repo/backend/confect/spend/rates";
import {
  type Claim,
  type Escrow,
  type Payer,
  SpendRefused,
} from "@repo/backend/confect/spend/schema";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Match,
  Option,
  String as Str,
} from "effect";

/**
 * The micro-dollars a month may spend for each credit a plan grants: the
 * credit's value, at most US$0.002 of direct AI cost, and the 25% reserve the
 * School pricing report of 2 November 2026 keeps for upkeep, errors and
 * retries on top of the foreground work the credits pay for.
 */
const BUDGET_PER_CREDIT = (CREDIT_UNIT_MICRO_USD * 12_500) / 10_000;

/**
 * Nakafa's own monthly budget, for work that belongs to no account: embedding
 * the published lessons and Quran text. One full re-embed of the 12,822
 * sections (ADR 0023) at the model's 8,192-token input limit costs
 * 12,822 x 8,192 x $0.20 / 1M x 1.25 = $26.26, so $30 holds one whole rebuild.
 */
const NAKAFA_BUDGET = 30_000_000;

/** The days of a plan's allowance a month can hold: a daily grant gives 31 in the longest month. */
const GRANT_DAYS = { "daily-grant": 31, "monthly-grant": 1 } as const;

/** The most vendor rows one payer has in one month: one per vendor. */
const VENDOR_ROWS = 4;

/** The calendar month (UTC) of `now`, `YYYY-MM`. */
export function monthOf(now: number) {
  return Str.slice(
    0,
    "YYYY-MM".length
  )(DateTime.formatIsoDateUtc(DateTime.makeUnsafe(now)));
}

/**
 * What a learner's month may spend: their plan's allowance over the month,
 * and every running top-up pack they bought, spent or not, because a pack's
 * credits pay for the calls that spend them.
 */
const learnerBudget = Effect.fn("spend.learnerBudget")(function* (
  userId: Docs["users"]["_id"],
  now: number
) {
  const reader = yield* DatabaseReader;
  const user = yield* reader.table("users").get(userId).pipe(Effect.orDie);
  const plan = getPlanCreditConfig(user.plan);
  const lots = yield* reader
    .table("creditLots")
    .index("by_userId_and_state_and_expiresAt", (query) =>
      query.eq("userId", userId).eq("state", "active").gt("expiresAt", now)
    )
    .take(MAX_CREDIT_LOTS)
    .pipe(Effect.orDie);
  const credits =
    plan.amount * GRANT_DAYS[plan.grantType] +
    Arr.reduce(lots, 0, (total, lot) => total + lot.granted);
  return credits * BUDGET_PER_CREDIT;
});

/**
 * Who pays for a claim at `now`, and the micro-dollars that payer's month may
 * spend. A member's work goes to their school while its plan grants AI
 * credits, and to their own account otherwise.
 */
const payerOf = Effect.fn("spend.payerOf")(function* (
  claim: Claim,
  now: number
) {
  return yield* Match.value(claim).pipe(
    Match.discriminatorsExhaustive("kind")({
      member: ({ tenantId, userId }) =>
        Effect.gen(function* () {
          const credits = yield* schoolCreditsOf(tenantId, now);
          if (credits > 0) {
            const payer: Payer = { kind: "school", tenantId };
            return { budget: credits * BUDGET_PER_CREDIT, payer };
          }
          const payer: Payer = { kind: "learner", userId };
          return { budget: yield* learnerBudget(userId, now), payer };
        }),
      school: ({ tenantId }) =>
        Effect.map(schoolCreditsOf(tenantId, now), (credits) => {
          const payer: Payer = { kind: "school", tenantId };
          return { budget: credits * BUDGET_PER_CREDIT, payer };
        }),
      learner: ({ userId }) =>
        Effect.map(learnerBudget(userId, now), (budget) => {
          const payer: Payer = { kind: "learner", userId };
          return { budget, payer };
        }),
      nakafa: () =>
        Effect.succeed({
          budget: NAKAFA_BUDGET,
          payer: { kind: "nakafa" } satisfies Payer,
        }),
    })
  );
});

/** The vendor rows of one payer's month. */
const monthRows = Effect.fn("spend.monthRows")(function* (
  payer: Payer,
  month: string
) {
  const table = (yield* DatabaseReader).table("vendorSpend");
  const query = Match.value(payer).pipe(
    Match.discriminatorsExhaustive("kind")({
      school: ({ tenantId }) =>
        table.index("by_tenantId_and_month", (index) =>
          index.eq("payer.tenantId", tenantId).eq("month", month)
        ),
      learner: ({ userId }) =>
        table.index("by_userId_and_month", (index) =>
          index.eq("payer.userId", userId).eq("month", month)
        ),
      nakafa: () =>
        table.index("by_kind_and_month", (index) =>
          index.eq("payer.kind", "nakafa").eq("month", month)
        ),
    })
  );
  return yield* query.take(VENDOR_ROWS).pipe(Effect.orDie);
});

/** What a month's rows used: what settled calls spent and what open calls hold. */
function usedOf(rows: readonly Docs["vendorSpend"][]) {
  return Arr.reduce(rows, 0, (total, row) => total + row.held + row.spent);
}

/** Adds one call's hold to its vendor's row of the month, made on the month's first call to that vendor. */
const holdOnRow = Effect.fn("spend.holdOnRow")(function* (
  rows: readonly Docs["vendorSpend"][],
  payer: Payer,
  month: string,
  vendor: Vendor,
  held: number
) {
  const writer = (yield* DatabaseWriter).table("vendorSpend");
  const row = Arr.findFirst(rows, (candidate) => candidate.vendor === vendor);
  if (Option.isSome(row)) {
    yield* writer
      .patch(row.value._id, {
        held: row.value.held + held,
        calls: row.value.calls + 1,
      })
      .pipe(Effect.orDie);
    return row.value._id;
  }
  return yield* writer
    .insert({ payer, month, vendor, held, spent: 0, calls: 1 })
    .pipe(Effect.orDie);
});

/**
 * Holds `held` micro-dollars for one call before it runs, in the transaction
 * that checks the payer's month: what the month spent and holds, with this
 * hold, stays within the budget the payer's plan grants, or the call is
 * refused and nothing is written.
 */
export const holdSpend = Effect.fn("spend.hold")(function* (
  claim: Claim,
  work: Work,
  held: number
) {
  const now = yield* Clock.currentTimeMillis;
  const { budget, payer } = yield* payerOf(claim, now);
  const month = monthOf(now);
  const vendor = vendorOf(work);
  const rows = yield* monthRows(payer, month);
  const used = usedOf(rows);
  if (used + held > budget) {
    return yield* new SpendRefused({ vendor, budget, used, held });
  }
  const spendId = yield* holdOnRow(rows, payer, month, vendor, held);
  const escrowId = yield* (yield* DatabaseWriter)
    .table("vendorEscrows")
    .insert({ spendId, work, held, state: { status: "held" } })
    .pipe(Effect.orDie);
  const escrow: Escrow = { escrowId, held };
  return escrow;
});

/**
 * Settles one call's escrow to what it cost: its row lets go of the hold and
 * adds the cost, which may be more than the hold when the call measured more
 * than its ceiling. An escrow settles once, so a second settle changes nothing.
 */
export const settleSpend = Effect.fn("spend.settle")(function* (
  escrowId: Docs["vendorEscrows"]["_id"],
  spent: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const escrow = yield* reader
    .table("vendorEscrows")
    .get(escrowId)
    .pipe(Effect.orDie);
  if (escrow.state.status === "settled") {
    return;
  }
  const row = yield* reader
    .table("vendorSpend")
    .get(escrow.spendId)
    .pipe(Effect.orDie);
  yield* writer
    .table("vendorSpend")
    .patch(row._id, {
      held: Math.max(0, row.held - escrow.held),
      spent: row.spent + spent,
    })
    .pipe(Effect.orDie);
  yield* writer
    .table("vendorEscrows")
    .patch(escrowId, { state: { status: "settled", spent } })
    .pipe(Effect.orDie);
});
