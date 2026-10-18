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
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { tenantProfile } from "@repo/backend/confect/tenancy/profile";
import {
  SCHOOL_LIMIT,
  type TenantProfile,
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
 * The member's tenant with its settings, its units with theirs, the caller's
 * grants, and the tenant capabilities: one indexed read past the member check.
 * Archived units come last, so a settings page can bring one back.
 */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.viewer.get")(function* () {
    const { grants, person, tenant } = yield* Member;
    const { appUser } = yield* requireAuth();
    const units = yield* (yield* DatabaseReader)
      .table("tenantUnits")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .take(UNIT_LIMIT)
      .pipe(Effect.orDie);
    const profile = yield* tenantProfile(tenant);
    return {
      account: accountOf(appUser),
      can: yield* tenantAuthority.allowed(tenant),
      grants: Arr.map(grants, grantView),
      person: { id: person._id, kind: person.kind, name: person.name },
      tenant: Struct.assign(Struct.assign(profile, tenantSettings(tenant)), {
        id: tenant._id,
      }),
      units: Arr.map(units, (unit) => ({
        contentLanguage: unit.contentLanguage,
        id: unit._id,
        level: unit.level,
        name: unit.name,
        status: unit.status,
        timeZone: unit.timeZone,
      })),
    };
  })
);

/**
 * The schools the caller is an active member of, newest membership first, at
 * most `SCHOOL_LIMIT`. One indexed read takes the caller's own active member
 * Persons, so suspended and operator Persons and other accounts' Persons never
 * appear. Each school is then one read, with its logo's address in its profile.
 */
const schools = FunctionImpl.make(
  databaseSchema,
  spec,
  "schools",
  Effect.fn("tenancy.viewer.schools")(function* () {
    const { appUser } = yield* requireAuth();
    const reader = yield* DatabaseReader;
    const people = yield* reader
      .table("tenantPeople")
      .index(
        "by_account_userId_and_kind_and_status",
        (query) =>
          query
            .eq("account.userId", appUser._id)
            .eq("kind", "member")
            .eq("status", "active"),
        "desc"
      )
      .take(SCHOOL_LIMIT)
      .pipe(Effect.orDie);
    return yield* Effect.forEach(
      people,
      (person) =>
        reader
          .table("tenants")
          .get(person.tenantId)
          .pipe(
            Effect.orDie,
            Effect.flatMap(tenantProfile),
            Effect.map((profile: typeof TenantProfile.Type) => ({
              mark: Struct.pick(profile, ["logo", "mascot"]),
              name: profile.name,
              slug: profile.slug,
            }))
          ),
      { concurrency: "unbounded" }
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(schools),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
