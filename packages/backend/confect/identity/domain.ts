import type { TenantsDoc } from "@repo/backend/confect/_generated/docs";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Effect, String as Str } from "effect";

/**
 * Decides whether a Google account of a school may sign in. The school's allowed
 * email domains are its Workspace domains: an empty list restricts nothing, and
 * otherwise the account's hosted-domain claim (`hd`) must be one of them. An
 * account without the claim, such as a personal Google account, is outside every
 * school domain. A refusal is written to the journal, as the system, before the
 * decision is returned: the caller returns it to the page without throwing, so
 * the entry commits with the refusal.
 */
export const checkWorkspaceDomain = Effect.fn("identity.domain.check")(
  function* (tenant: TenantsDoc, hostedDomain: string | undefined) {
    const domains = tenant.policies.emailDomains;
    if (
      Arr.isReadonlyArrayEmpty(domains) ||
      (hostedDomain !== undefined &&
        Arr.contains(domains, Str.toLowerCase(hostedDomain)))
    ) {
      return "allowed";
    }
    yield* tenantAuthority.record(systemActor, tenant, {
      reason: "domain",
      type: "identity.blocked",
    });
    return "domain";
  }
);
