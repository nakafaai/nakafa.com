import type { GenericId } from "@confect/core";
import type { TenantsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { openVisitOf, viewOf } from "@repo/backend/confect/operators/visit";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { Effect, Option } from "effect";

/** The school a tenant ID names. An ID that names no school is `TenantNotFound`. */
export const loadTenant = Effect.fn("operators.directory.tenant")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return yield* (yield* DatabaseReader)
    .table("tenants")
    .get(tenantId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIdFailure: () => new TenantNotFound(),
      })
    );
});

/**
 * One school as the operator directory shows it: its metadata, its units, and the
 * open visit of this operator to it. No Person and no personal data leaves the
 * school, so the directory is the one read across schools (ADR 0011).
 */
export const rowOf = Effect.fn("operators.directory.row")(function* (
  tenant: TenantsDoc,
  operatorId: GenericId.GenericId<"operators">
) {
  const units = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", tenant._id)
    )
    .take(UNIT_LIMIT)
    .pipe(Effect.orDie);
  const open = yield* openVisitOf(tenant._id, operatorId);
  return {
    id: tenant._id,
    kind: tenant.kind,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    unitCount: units.length,
    visit: Option.match(open, { onNone: () => null, onSome: viewOf }),
  };
});
