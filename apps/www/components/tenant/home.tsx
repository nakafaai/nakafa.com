"use client";

import { useTranslations } from "next-intl";
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
    <p className="px-4 py-6 text-sm">
      {tenant.role === null
        ? t("signed-in")
        : t("signed-in-as", { role: t(`role.${tenant.role}`) })}
    </p>
  );
}
