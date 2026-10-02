import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { grantView } from "@repo/backend/confect/access/grant";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  tenantProfile,
  UNIT_LIMIT,
} from "@repo/backend/confect/tenancy/schema";
import spec from "@repo/backend/confect/tenancy/viewer.spec";
import { Array as Arr, Effect, Layer, Struct } from "effect";

/** The member's tenant, active units, grants, and tenant capabilities: one indexed read past the member check. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.viewer.get")(function* () {
    const { grants, person, tenant } = yield* Member;
    const units = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    return {
      can: yield* tenantAuthority.allowed(tenant),
      grants: Arr.map(grants, grantView),
      person: { id: person._id, kind: person.kind, name: person.name },
      tenant: Struct.assign(tenantProfile(tenant), { id: tenant._id }),
      units: Arr.map(units, (unit) => ({
        id: unit._id,
        level: unit.level,
        name: unit.name,
      })),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
