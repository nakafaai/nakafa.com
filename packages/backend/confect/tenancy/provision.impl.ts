import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { assignRole } from "@repo/backend/confect/access/grant";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAuthority,
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { ProvisionRejected } from "@repo/backend/confect/tenancy/errors";
import { writeInvite } from "@repo/backend/confect/tenancy/invite";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import spec, {
  type UnitDraft,
} from "@repo/backend/confect/tenancy/provision.spec";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { NewTenantSlug } from "@repo/backend/confect/tenancy/slug";
import { createTenantKey } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";

/** Adds one active school to the organisation and records it. */
const createUnit = Effect.fn("tenancy.provision.unit")(function* (
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
  yield* unitAuthority.record(systemActor, unit, { type: "unit.created" });
  return unitId;
});

/**
 * Opens an organisation in one transaction: the tenant, its schools, its first
 * Owner as a Person nobody has claimed yet, the invite that names the Owner's
 * address, and the Owner role. Each of those writes is in the journal. The
 * school's key is written in the same transaction but is not journaled, because
 * ADR 0016 lists what the journal records and a key is not among them. The
 * invitation email starts with the transaction, in the content language of the
 * first school, and an account that already holds the address claims the Person
 * moments later.
 */
const open = FunctionImpl.make(
  databaseSchema,
  spec,
  "open",
  Effect.fn("tenancy.provision.open")(function* (args) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    if (!Schema.is(NewTenantSlug)(args.slug)) {
      return yield* new ProvisionRejected({
        code: "SLUG_RESERVED",
        message: "This address is reserved.",
      });
    }
    const taken = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", args.slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(taken)) {
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
      systemActor,
      yield* reader.table("tenants").get(tenantId).pipe(Effect.orDie),
      { contract: args.contract, type: "tenant.provisioned" }
    );
    const units = yield* Effect.forEach(args.units, (draft) =>
      createUnit(tenantId, draft)
    );
    const ownerId = yield* writer
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name: args.owner.name,
        status: "active",
        tenantId,
      })
      .pipe(Effect.orDie);
    const owner = yield* reader
      .table("tenantPeople")
      .get(ownerId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(systemActor, owner, {
      type: "person.created",
    });
    const invite = yield* writeInvite(
      systemActor,
      owner,
      args.owner.email,
      Arr.headNonEmpty(args.units).contentLanguage
    );
    // A new active member Person in a new tenant meets every grant invariant.
    yield* assignRole(systemActor, owner, "owner", { kind: "tenant" }).pipe(
      Effect.orDie
    );
    return { invite: invite._id, owner: ownerId, tenant: tenantId, units };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  GroupImpl.finalize
);
