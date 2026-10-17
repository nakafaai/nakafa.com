import { SITE_ORIGIN } from "@repo/seo/origin";
import { getLocale } from "next-intl/server";
import { Stage } from "@/components/state/stage";
import { TenantMissing } from "@/components/tenant/missing";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * The not-found page of a school address that the school does not answer: an
 * unknown school, or a viewer who is not a member. The school's own home would
 * answer not found as well, so the one way on leads to Nakafa.
 */
export default async function SchoolNotFound() {
  const locale = getLocaleOrThrow(await getLocale());

  return (
    <Stage>
      <TenantMissing homeHref={new URL(`/${locale}`, SITE_ORIGIN).href} />
    </Stage>
  );
}
