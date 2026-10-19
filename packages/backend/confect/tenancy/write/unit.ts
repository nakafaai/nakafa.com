import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { unitAuthority } from "@repo/backend/confect/tenancy/authority";
import type { UnitDraft } from "@repo/backend/confect/tenancy/provision.spec";
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
