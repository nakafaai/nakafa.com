"use client";

import { useTranslations } from "next-intl";
import { LayoutContent } from "@/components/shared/content/layout";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { StudentSittings } from "@/components/tenant/sittings";

/**
 * Beranda of a school: its header, then one line with the viewer's role. The school's name is in
 * the sidebar header, so the page does not repeat it. A viewer without a grant
 * sees a line that states only the sign-in, because the page states nothing that
 * the viewer does not hold.
 */
export function TenantHome() {
  const tenant = useTenant();
  const t = useTranslations("School");
  const tCommon = useTranslations("Common");

  return (
    <>
      <SchoolHeader items={[]} title={tCommon("home")} />
      <LayoutContent className="w-full py-6 text-sm">
        <p>
          {tenant.role === null
            ? t("signed-in")
            : t("signed-in-as", { role: t(`role.${tenant.role}`) })}
        </p>
        <StudentSittings />
      </LayoutContent>
    </>
  );
}
