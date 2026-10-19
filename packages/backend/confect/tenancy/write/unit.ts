import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import { UnitLimit } from "@repo/backend/confect/tenancy/errors";
import type { UnitDraft } from "@repo/backend/confect/tenancy/provision.spec";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { Effect } from "effect";

/** Adds one active school to the organisation and records it as `actor`. */
export const createUnit = Effect.fn("tenancy.write.unit.create")(function* (
  actor: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  draft: typeof UnitDraft.Type
) {
  const unitId = yield* (yield* DatabaseWriter)
    .table("tenantUnits")
    .insert({ ...draft, status: "active", tenantId })
    .pipe(Effect.orDie);
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(unitId)
    .pipe(Effect.orDie);
  yield* unitAuthority.record(actor, unit, { type: "unit.created" });
  return unit;
});

/**
 * Adds one school to an organisation, as `createUnit` does, and refuses it when the organisation
 * already holds `UNIT_LIMIT` schools: nothing is written then.
 */
export const addUnit = Effect.fn("tenancy.write.unit.add")(function* (
  actor: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  draft: typeof UnitDraft.Type
) {
  const units = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) => query.eq("tenantId", tenantId))
    .take(UNIT_LIMIT)
    .pipe(Effect.orDie);
  if (units.length >= UNIT_LIMIT) {
    return yield* new UnitLimit();
  }
  return yield* createUnit(actor, tenantId, draft);
});
