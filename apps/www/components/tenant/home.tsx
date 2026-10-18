"use client";

import { useTranslations } from "next-intl";
import { LayoutContent } from "@/components/shared/content/layout";
import { useTenant } from "@/components/tenant/context";

/**
 * Beranda of a school: one line with the viewer's role. The school's name is in
 * the sidebar header, so the page does not repeat it. A viewer without a grant
 * sees a line that states only the sign-in, because the page states nothing that
 * the viewer does not hold.
 */
export function TenantHome() {
  const tenant = useTenant();
  const t = useTranslations("School");

  return (
    <LayoutContent className="w-full py-6 text-sm">
      <p>
        {tenant.role === null
          ? t("signed-in")
          : t("signed-in-as", { role: t(`role.${tenant.role}`) })}
      </p>
    </LayoutContent>
  );
}
