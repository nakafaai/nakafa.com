import { FunctionSpec, GroupSpec } from "@confect/core";
import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Currency, NewCurrency } from "@repo/backend/confect/tenancy/locale";
import { Policy, TenantPolicies } from "@repo/backend/confect/tenancy/policy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * What an Owner or an Admin changes for the whole organisation. Each mutation
 * answers with the value now stored, so a screen that showed the change first
 * can confirm it, and a refusal is a typed denial that the screen undoes the
 * change on.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setLocale",
      args: () => ({
        country: CountryCodeSchema,
        currency: NewCurrency,
        slug: TenantSlug,
      }),
      returns: () =>
        Schema.Struct({ country: CountryCodeSchema, currency: Currency }),
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setPolicy",
      args: () => ({ policy: Policy, slug: TenantSlug }),
      returns: () => TenantPolicies,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  );
