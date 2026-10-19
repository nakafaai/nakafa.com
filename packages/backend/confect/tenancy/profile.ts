import type { GenericId } from "@confect/core";
import type { TenantsDoc } from "@repo/backend/confect/_generated/docs";
import { StorageReader } from "@repo/backend/confect/_generated/services";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { Effect, Struct } from "effect";

/**
 * The address of a stored logo file. A logo is removed together with its file,
 * so a logo that names no file is a defect, not an answer.
 */
export const logoUrl = Effect.fn("tenancy.profile.logoUrl")(function* (
  storageId: GenericId.GenericId<"_storage">
) {
  const url = yield* (yield* StorageReader)
    .getUrl(storageId)
    .pipe(Effect.orDie);
  return url.href;
});

/**
 * The public profile of a school: its kind, name, address and status, its
 * animal, and the address of its logo when it has one.
 */
export const tenantProfile = Effect.fn("tenancy.profile.of")(function* (
  tenant: TenantsDoc
) {
  const shown = Struct.pick(tenant, ["kind", "name", "slug", "status"]);
  const mascot = schoolMascot(tenant.slug);
  if (tenant.logo === undefined) {
    return { ...shown, mascot };
  }
  return { ...shown, logo: yield* logoUrl(tenant.logo), mascot };
});
