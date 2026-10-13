import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  applyPolicy,
  TenantPolicies,
} from "@repo/backend/confect/tenancy/policy";
import spec from "@repo/backend/confect/tenancy/settings.spec";
import { Effect, Layer, Schema, Struct } from "effect";

/** Two policy sets are the same when every choice agrees and both allow the same domains, in any order. */
const samePolicies = Schema.toEquivalence(TenantPolicies);

/**
 * Sets the country and the contract currency. A value that is already stored
 * writes and records nothing, so a screen that sends it twice, or retries, is
 * done the first time.
 */
const setLocale = FunctionImpl.make(
  databaseSchema,
  spec,
  "setLocale",
  Effect.fn("tenancy.settings.setLocale")(function* ({ country, currency }) {
    const { person, tenant } = yield* Member;
    if (tenant.country !== country || tenant.currency !== currency) {
      yield* (yield* DatabaseWriter)
        .table("tenants")
        .replace(
          tenant._id,
          Struct.assign(Struct.omit(tenant, ["_creationTime", "_id"]), {
            country,
            currency,
          })
        )
        .pipe(Effect.orDie);
      yield* tenantAuthority.record(personActor(person), tenant, {
        country,
        currency,
        type: "tenant.locale.set",
      });
    }
    return { country, currency };
  })
);

/**
 * Changes one policy and leaves the others as they are. A value that is
 * already stored, the same domains in another order included, writes and
 * records nothing, and the answer is what is stored.
 */
const setPolicy = FunctionImpl.make(
  databaseSchema,
  spec,
  "setPolicy",
  Effect.fn("tenancy.settings.setPolicy")(function* ({ policy }) {
    const { person, tenant } = yield* Member;
    const policies = applyPolicy(tenant.policies, policy);
    if (samePolicies(tenant.policies, policies)) {
      return tenant.policies;
    }
    yield* (yield* DatabaseWriter)
      .table("tenants")
      .replace(
        tenant._id,
        Struct.assign(Struct.omit(tenant, ["_creationTime", "_id"]), {
          policies,
        })
      )
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(personActor(person), tenant, {
      policy,
      type: "tenant.policy.set",
    });
    return policies;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setLocale),
  Layer.provide(setPolicy),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
