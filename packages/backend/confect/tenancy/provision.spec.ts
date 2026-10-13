import { FunctionSpec, GroupSpec } from "@confect/core";
import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { Id } from "@repo/backend/confect/_generated/id";
import { Contract } from "@repo/backend/confect/tenancy/contract";
import { ProvisionRejected } from "@repo/backend/confect/tenancy/errors";
import { NewCurrency, NewTimeZone } from "@repo/backend/confect/tenancy/locale";
import {
  Email,
  PersonName,
  TenantKind,
  TenantName,
  unitFields,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One school that a new organisation opens with. */
export const UnitDraft = Schema.Struct({
  ...unitFields,
  timeZone: NewTimeZone,
});

/**
 * Opens an organisation, the way Nakafa staff do it from the command line with
 * the deployment's key. It is internal, so no browser can call it.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "open",
    args: () => ({
      contract: Contract,
      country: CountryCodeSchema,
      currency: NewCurrency,
      kind: TenantKind,
      name: TenantName,
      owner: Schema.Struct({ email: Email, name: PersonName }),
      slug: TenantSlug,
      units: Schema.Array(UnitDraft),
    }),
    returns: () =>
      Schema.Struct({
        invite: Id("tenantInvites"),
        owner: Id("tenantPeople"),
        tenant: Id("tenants"),
        units: Schema.Array(Id("tenantUnits")),
      }),
    error: () => ProvisionRejected,
  })
);
