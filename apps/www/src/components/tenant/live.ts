import type { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import type { TenantValue } from "@/components/tenant/context";

/**
 * The school as the shell shows it: the name and the logo that the viewer's live query holds
 * once it answers, and the ones the layout rendered until then. A live school with no logo
 * shows no logo, so a removed logo leaves the mark at once.
 */
export function liveTenant(
  rendered: TenantValue,
  live: Pick<typeof TenantProfile.Type, "logo" | "name"> | undefined
): TenantValue {
  if (live === undefined) {
    return rendered;
  }
  return { ...rendered, logo: live.logo, name: live.name };
}
