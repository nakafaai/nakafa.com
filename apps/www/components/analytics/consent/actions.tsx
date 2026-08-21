"use client";

import { LockIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "next-intl";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";

/** Adds a permanent privacy preference action to the marketing footer. */
export function AnalyticsConsentFooterItem() {
  const t = useTranslations("AnalyticsConsent");
  const isAvailable = useAnalyticsConsent((state) => state.isAvailable);
  const setPreferencesOpen = useAnalyticsConsent(
    (state) => state.setPreferencesOpen
  );

  if (!isAvailable) {
    return null;
  }

  return (
    <li>
      <Button
        className="h-auto justify-start p-0 text-foreground no-underline transition-colors ease-out hover:text-primary"
        onClick={() => setPreferencesOpen(true)}
        type="button"
        variant="link"
      >
        {t("manage")}
      </Button>
    </li>
  );
}

/** Adds the privacy preference action to account menus. */
export function AnalyticsConsentMenuItem() {
  const t = useTranslations("AnalyticsConsent");
  const isAvailable = useAnalyticsConsent((state) => state.isAvailable);
  const setPreferencesOpen = useAnalyticsConsent(
    (state) => state.setPreferencesOpen
  );

  if (!isAvailable) {
    return null;
  }

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onClick={() => setPreferencesOpen(true)}
    >
      <HugeIcons icon={LockIcon} />
      {t("manage")}
    </DropdownMenuItem>
  );
}

/** Keeps privacy preferences reachable for signed-out sidebar visitors. */
export function AnalyticsConsentSidebarItem() {
  const t = useTranslations("AnalyticsConsent");
  const isAvailable = useAnalyticsConsent((state) => state.isAvailable);
  const setPreferencesOpen = useAnalyticsConsent(
    (state) => state.setPreferencesOpen
  );

  if (!isAvailable) {
    return null;
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setPreferencesOpen(true)}>
        <HugeIcons icon={LockIcon} />
        {t("manage")}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
