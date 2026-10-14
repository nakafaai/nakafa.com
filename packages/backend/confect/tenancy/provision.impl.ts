import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { assignRole } from "@repo/backend/confect/access/grant";
import { startInviteEmail } from "@repo/backend/confect/emails/invite/workflow";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  personAuthority,
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { claimAfterInvite } from "@repo/backend/confect/tenancy/claims";
import { ProvisionRejected } from "@repo/backend/confect/tenancy/errors";
import { NEW_TENANT_POLICIES } from "@repo/backend/confect/tenancy/policy";
import spec, {
  type UnitDraft,
} from "@repo/backend/confect/tenancy/provision.spec";
import { UNIT_LIMIT } from "@repo/backend/confect/tenancy/schema";
import { NewTenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";

/** Nakafa staff open an organisation with the deployment's key, so no Person acts: the journal files it as scheduled work. */
const system: typeof TenantActor.Type = { kind: "system" };

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
  yield* unitAuthority.record(system, unit, { type: "unit.created" });
  return unitId;
});

/**
 * Opens an organisation in one transaction: the tenant, its schools, its first
 * Owner as a Person nobody has claimed yet, the invite that names the Owner's
 * address, and the Owner role. Each write is in the journal. The invitation
 * email starts with the transaction, in the content language of the first
 * school, and an account that already holds the address claims the Person
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
    yield* tenantAuthority.record(
      system,
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
    const inviteId = yield* writer
      .table("tenantInvites")
      .insert({
        channel: { email: args.owner.email, kind: "email" },
        personId: ownerId,
        state: { status: "pending" },
        tenantId,
      })
      .pipe(Effect.orDie);
    const owner = yield* reader
      .table("tenantPeople")
      .get(ownerId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(system, owner, { type: "person.created" });
    yield* personAuthority.record(system, owner, {
      invite: inviteId,
      type: "person.invited",
    });
    // A new active member Person in a new tenant meets every grant invariant.
    yield* assignRole(system, owner, "owner", { kind: "tenant" }).pipe(
      Effect.orDie
    );
    yield* startInviteEmail(
      inviteId,
      Arr.headNonEmpty(args.units).contentLanguage
    );
    yield* claimAfterInvite(args.owner.email);
    return { invite: inviteId, owner: ownerId, tenant: tenantId, units };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(open),
  GroupImpl.finalize
);
