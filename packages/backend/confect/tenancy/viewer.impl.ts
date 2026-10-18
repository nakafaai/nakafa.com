import { FunctionImpl, GroupImpl } from "@confect/server";
import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { grantView } from "@repo/backend/confect/access/grant";
import { requireAuth } from "@repo/backend/confect/auth/session";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import {
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { tenantProfile } from "@repo/backend/confect/tenancy/profile";
import {
  tenantSettings,
  UNIT_LIMIT,
} from "@repo/backend/confect/tenancy/schema";
import spec from "@repo/backend/confect/tenancy/viewer.spec";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Array as Arr, Effect, Layer, Struct } from "effect";

/**
 * The caller's account as its school shows it: its name and its animal as the
 * account stores them, its username when it has one, and its photo only while the
 * account shows the photo, which `photoOf` decides.
 */
const accountOf = (appUser: UsersDoc) => {
  const photo = photoOf(appUser);
  return {
    mascot: appUser.mascot,
    name: appUser.name,
    ...(appUser.username === undefined ? {} : { username: appUser.username }),
    ...(photo === undefined ? {} : { image: photo }),
  };
};

/**
 * The member's tenant with its settings, its units with theirs and the actions the
 * caller may take on each, the caller's grants, and the tenant capabilities: one
 * indexed read past the member check. A unit's actions come from the row and the
 * grants the member check already read. Archived units come last, so a settings
 * page can bring one back.
 */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.viewer.get")(function* () {
    const { grants, person, tenant } = yield* Member;
    const { appUser } = yield* requireAuth();
    const rows = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    const profile = yield* tenantProfile(tenant);
    const units = yield* Effect.forEach(rows, (unit) =>
      Effect.map(unitAuthority.allowed(unit), (can) => ({
        can,
        contentLanguage: unit.contentLanguage,
        id: unit._id,
        level: unit.level,
        name: unit.name,
        status: unit.status,
        timeZone: unit.timeZone,
      }))
    );
    return {
      account: accountOf(appUser),
      can: yield* tenantAuthority.allowed(tenant),
      grants: Arr.map(grants, grantView),
      person: { id: person._id, kind: person.kind, name: person.name },
      tenant: Struct.assign(Struct.assign(profile, tenantSettings(tenant)), {
        id: tenant._id,
      }),
      units,
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
