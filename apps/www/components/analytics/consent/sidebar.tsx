"use client";

import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "next-intl";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";

/** Keeps privacy preferences reachable for signed-out sidebar visitors. */
export function AnalyticsConsentSidebarItem() {
  const t = useTranslations("AnalyticsConsent");
  const consent = useAnalyticsConsent((state) => state);

  if (!consent.isAvailable) {
    return null;
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => consent.setPreferencesOpen(true)}
        onFocus={consent.warmPreferences}
        onPointerDown={consent.warmPreferences}
        onPointerEnter={consent.warmPreferences}
      >
        <HugeIcons icon={Analytics01Icon} />
        {t("manage")}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
