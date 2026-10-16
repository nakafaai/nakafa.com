"use client";

import { useTranslations } from "next-intl";
import { useTenant } from "@/components/tenant/context";

/**
 * Beranda of a school: one line with the school's name and, when the viewer
 * holds a grant, the viewer's role. A viewer without a grant sees the school
 * alone, because the page states nothing that the viewer does not hold.
 */
export function TenantHome() {
  const tenant = useTenant();
  const t = useTranslations("School");

  return (
    <p className="px-4 py-6 text-sm">
      {tenant.role === null
        ? t("signed-in-to", { school: tenant.name })
        : t("signed-in-as", {
            role: t(`role.${tenant.role}`),
            school: tenant.name,
          })}
    </p>
  );
}
