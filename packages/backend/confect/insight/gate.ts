import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { DpiaRequired } from "@repo/backend/confect/insight/errors";
import { Effect, Option } from "effect";

/** A school's impact assessment in force, the newest on record. */
export const dpiaOf = Effect.fn("insight.gate.dpia")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* (yield* DatabaseReader)
    .table("insightDpias")
    .index(
      "by_tenantId_and_recordedAt",
      (query) => query.eq("tenantId", tenantId),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
});

/** Insight stays off in a school until its impact assessment is on record (ADR 0035). */
export const requireDpia = Effect.fn("insight.gate.require")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  if (Option.isNone(yield* dpiaOf(tenantId))) {
    return yield* new DpiaRequired();
  }
});
