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

/** The answer of a locked report card's hash, if the hash names one. */
const reportAnswer = Effect.fn("records.checks.reportAnswer")(function* (
  hash: string
) {
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
    return Option.none<typeof VerifyAnswer.Type>();
  }
  const [tenant, period] = yield* Effect.all([
    reader.table("tenants").get(found.value.tenantId).pipe(Effect.orDie),
    reader.table("tenantPeriods").get(found.value.periodId).pipe(Effect.orDie),
  ]);
  return Option.some<typeof VerifyAnswer.Type>({
    approvedAt: found.value.approvedAt,
    kind: "report",
    outcome: "locked",
    period: period.name,
    school: tenant.name,
  });
});

/** The answer of a locked SKL's hash, if the hash names one: its unit, its period, and its issue. */
const letterAnswer = Effect.fn("records.checks.letterAnswer")(function* (
  hash: string
) {
  const reader = yield* DatabaseReader;
  const found = yield* reader
    .table("graduationLetters")
    .index("by_hash", (query) => query.eq("hash", hash))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(found) || found.value.state !== "locked") {
    return Option.none<typeof VerifyAnswer.Type>();
  }
  const [unit, period] = yield* Effect.all([
    reader.table("tenantUnits").get(found.value.unitId).pipe(Effect.orDie),
    reader.table("tenantPeriods").get(found.value.periodId).pipe(Effect.orDie),
  ]);
  return Option.some<typeof VerifyAnswer.Type>({
    approvedAt: found.value.issuedAt,
    kind: "letter",
    outcome: "locked",
    period: period.name,
    school: unit.name,
  });
});

/**
 * Checks a hash from a QR code (ADR 0033, S5 and S6): a locked report card answers its school,
 * the kind of document, its period, and its approval date, and a locked SKL its unit, its kind,
 * its period, and its issue date, and nothing about the student. Any other hash, and a check
 * past the limit, answers unknown.
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
    const answer = yield* reportAnswer(hash);
    if (Option.isSome(answer)) {
      return answer.value;
    }
    return Option.getOrElse(yield* letterAnswer(hash), () => UNKNOWN);
  })
);

/** The public checks of report card and SKL hashes. */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(report),
  GroupImpl.finalize
);
