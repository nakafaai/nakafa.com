import { FunctionImpl, GroupImpl } from "@confect/server";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/records/checks.spec";
import type { VerifyAnswer } from "@repo/backend/confect/records/report";
import { Effect, Layer, Option } from "effect";

/**
 * The public checks of report hashes, as one bucket for every caller: 300 a minute. A
 * hash is 256 bits, so the limit is not what keeps a report unknown; it keeps the check
 * cheap. A design choice, not a measurement.
 */
const LIMITS = {
  reportCheck: {
    capacity: 300,
    kind: "token bucket",
    period: MINUTE,
    rate: 300,
  },
} as const;

const limits = new RateLimiter(components.agentRateLimiter, LIMITS);

/** The one answer of a hash that names no locked report, and of a check past the limit. */
const UNKNOWN: typeof VerifyAnswer.Type = { outcome: "unknown" };

/**
 * Checks a report hash from its QR code (ADR 0033, S5): a locked report answers its
 * school, the kind of document, its period, and its approval date, and nothing about
 * its student. Any other hash, and a check past the limit, answers unknown.
 */
const report = FunctionImpl.make(
  databaseSchema,
  spec,
  "report",
  Effect.fn("records.checks.report")(function* ({ hash }) {
    const ctx = yield* MutationCtx;
    const quota = yield* Effect.tryPromise(() =>
      limits.limit(ctx, "reportCheck")
    ).pipe(Effect.orDie);
    if (!quota.ok) {
      return UNKNOWN;
    }
    const reader = yield* DatabaseReader;
    const found = yield* reader
      .table("reportCards")
      .index("by_hash", (query) => query.eq("hash", hash))
      .first()
      .pipe(Effect.orDie);
    if (
      Option.isNone(found) ||
      found.value.state !== "locked" ||
      found.value.approvedAt === undefined
    ) {
      return UNKNOWN;
    }
    const [tenant, period] = yield* Effect.all([
      reader.table("tenants").get(found.value.tenantId).pipe(Effect.orDie),
      reader
        .table("tenantPeriods")
        .get(found.value.periodId)
        .pipe(Effect.orDie),
    ]);
    const answer: typeof VerifyAnswer.Type = {
      approvedAt: found.value.approvedAt,
      kind: "report",
      outcome: "locked",
      period: period.name,
      school: tenant.name,
    };
    return answer;
  })
);

/** The public checks of report hashes. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(report),
  GroupImpl.finalize
);
