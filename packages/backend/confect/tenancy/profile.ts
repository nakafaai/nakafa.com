import type { TenantsDoc } from "@repo/backend/confect/_generated/docs";
import { fileAddress } from "@repo/backend/confect/bucket/file";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { Effect, Option, Struct } from "effect";

/**
 * The public profile of a school: its kind, name, address and status, its
 * animal, and the R2 address of its logo when it has one stored, signed for the
 * hour.
 */
export const tenantProfile = Effect.fn("tenancy.profile.of")(function* (
  tenant: TenantsDoc
) {
  const shown = Struct.pick(tenant, ["kind", "name", "slug", "status"]);
  const mascot = schoolMascot(tenant.slug);
  const logo =
    tenant.logo === undefined
      ? Option.none<string>()
      : yield* fileAddress(tenant.logo);
  return Option.match(logo, {
    onNone: () => ({ ...shown, mascot }),
    onSome: (address) => ({ ...shown, logo: address, mascot }),
  });
});
