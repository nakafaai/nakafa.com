import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { assignRole } from "@repo/backend/confect/access/grant";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { readAddress } from "@repo/backend/confect/tenancy/address";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import { ProvisionRejected } from "@repo/backend/confect/tenancy/errors";
import {
  inviteToSchool,
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import spec, {
  type OpenRequest,
} from "@repo/backend/confect/tenancy/provision.spec";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { createUnit } from "@repo/backend/confect/tenancy/write/unit";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Effect, Layer } from "effect";

/**
 * Opens an organisation in one transaction: the tenant, its schools, its first
 * Owner as a Person nobody has claimed yet, the invite that names the Owner's
 * address, and the Owner role. Each of those writes is in the journal under
 * `actor`, which is the system for Nakafa staff's command and the operator for
 * the console. The school's key is written in the same transaction but is not
 * journaled, because ADR 0016 lists what the journal records and a key is not
 * among them. The invitation email starts with the transaction, in the content language of the
 * first school, and an account that already holds the address claims the Person
 * moments later.
 */
export const openTenant = Effect.fn("tenancy.provision.tenant")(function* (
  actor: typeof TenantActor.Type,
  args: typeof OpenRequest.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const address = yield* readAddress(args.slug);
  if (address === "reserved") {
    return yield* new ProvisionRejected({
      code: "SLUG_RESERVED",
      message: "This address is reserved.",
    });
  }
  if (address === "taken") {
    return yield* new ProvisionRejected({
      code: "SLUG_TAKEN",
      message: "Another organisation already uses this address.",
    });
  }
  if (!Arr.isReadonlyArrayNonEmpty(args.units)) {
    return yield* new ProvisionRejected({
      code: "UNIT_REQUIRED",
      message: "An organisation opens with at least one school.",
    });
  }
  if (args.units.length > UNIT_LIMIT) {
    return yield* new ProvisionRejected({
      code: "UNIT_LIMIT",
      message: `An organisation holds at most ${UNIT_LIMIT} schools.`,
    });
  }
  const tenantId = yield* writer
    .table("tenants")
    .insert({
      country: args.country,
      currency: args.currency,
      kind: args.kind,
      name: args.name,
      policies: NEW_TENANT_POLICIES,
      slug: args.slug,
      status: "active",
    })
    .pipe(Effect.orDie);
  // The school's key is written in this transaction too, so no school exists
  // without one (ADR 0030).
  yield* createTenantKey(tenantId).pipe(Effect.orDie);
  yield* tenantAuthority.record(
    actor,
    yield* reader.table("tenants").get(tenantId).pipe(Effect.orDie),
    { contract: args.contract, type: "tenant.provisioned" }
  );
  const units = yield* Effect.forEach(args.units, (draft) =>
    createUnit(actor, tenantId, draft).pipe(Effect.map((unit) => unit._id))
  );
  const owner = yield* createPerson(actor, tenantId, args.owner.name);
  const invite = yield* writeInvite(
    actor,
    owner,
    args.owner.email,
    Arr.headNonEmpty(args.units).contentLanguage
  );
  // A new active member Person in a new tenant meets every grant invariant.
  yield* assignRole(actor, owner, "owner", { kind: "tenant" }).pipe(
    Effect.orDie
  );
  return { invite: invite._id, owner: owner._id, tenant: tenantId, units };
});

/** The acceptance command's invite, as the system, so the journal names no staff member. */
const invite = FunctionImpl.make(
  databaseSchema,
  spec,
  "invite",
  Effect.fn("tenancy.provision.invite")(function* (args) {
    return yield* inviteToSchool(systemActor, args);
  })
);

/** Nakafa staff's command: opens an organisation as the system, so the journal names no staff member. */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("tenancy.provision.open")(function* (args) {
    return yield* openTenant(systemActor, args);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  Layer.provide(invite),
  GroupImpl.finalize
);
