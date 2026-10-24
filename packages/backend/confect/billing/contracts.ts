import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureAccount } from "@repo/backend/confect/billing/accounts";
import { scheduleSchoolProjection } from "@repo/backend/confect/billing/grants";
import { billingCurrencyFor } from "@repo/backend/confect/billing/route";
import {
  ContractWindowInvalid,
  TenantNotFound,
} from "@repo/backend/confect/billing/spec";
import { Effect, Option, Schema } from "effect";

/** A school contract the operator signed and received payment for, outside any payment rail. */
const SchoolContract = Schema.Struct({
  contractId: Schema.String,
  seats: Schema.Int,
  tenantSlug: Schema.String,
  validFrom: Schema.Finite,
  validTo: Schema.Finite,
});
type SchoolContract = typeof SchoolContract.Type;

/**
 * Records one school contract as a grant of Pro for the school's students, for
 * its current term. A contract grant carries no Nina school pool, so the AI
 * cost of the school stays where the price was set. Bank-transfer payments have
 * no provider, so the operator's contract ID is the grant's only reference.
 *
 * The contract ID is the identity of the grant: a second call with the same ID
 * returns the grant the first call wrote, so a retried operator call never adds
 * a second grant. Changed terms need a new contract ID.
 */
export const recordSchoolContract = Effect.fn("billing.contracts.record")(
  function* (contract: SchoolContract) {
    if (contract.validTo <= contract.validFrom) {
      return yield* new ContractWindowInvalid({
        contractId: contract.contractId,
        message: `Contract ${contract.contractId} ends no later than it starts.`,
      });
    }
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", contract.tenantSlug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound({
        slug: contract.tenantSlug,
        message: `No school has the slug ${contract.tenantSlug}.`,
      });
    }
    const accountId = yield* ensureAccount({
      owner: { kind: "tenant", tenantId: tenant.value._id },
      rail: "polar",
      country: tenant.value.country,
      currency: billingCurrencyFor(tenant.value.country),
    });
    const existing = yield* reader
      .table("billingGrants")
      .index("by_source_contractId", (query) =>
        query.eq("source.contractId", contract.contractId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(existing)) {
      return { accountId, grantId: existing.value._id };
    }
    const writer = yield* DatabaseWriter;
    const grantId = yield* writer
      .table("billingGrants")
      .insert({
        product: "school",
        tenantId: tenant.value._id,
        scope: { kind: "tenant" },
        seats: contract.seats,
        ninaSeats: 0,
        source: { kind: "contract", contractId: contract.contractId },
        validFrom: contract.validFrom,
        validTo: contract.validTo,
      })
      .pipe(Effect.orDie);
    yield* scheduleSchoolProjection(tenant.value._id);
    return { accountId, grantId };
  }
);
