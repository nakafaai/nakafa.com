import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureAccount } from "@repo/backend/confect/billing/accounts";
import { billingCurrencyFor } from "@repo/backend/confect/billing/route";
import { TenantNotFound } from "@repo/backend/confect/billing/spec";
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
 */
export const recordSchoolContract = Effect.fn("billing.contracts.record")(
  function* (contract: SchoolContract) {
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
    return { accountId, grantId };
  }
);
