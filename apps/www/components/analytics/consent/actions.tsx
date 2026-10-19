"use client";

import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "use-intl";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";

/** Adds a permanent privacy preference action to the marketing footer. */
export function AnalyticsConsentFooterItem() {
  const t = useTranslations("AnalyticsConsent");
  const consent = useAnalyticsConsent((state) => state);

  if (!consent.isAvailable) {
    return null;
  }

  return (
    <li>
      <Button
        className="-my-0.5 h-6 justify-start p-0 text-foreground no-underline hover:text-primary"
        onClick={() => consent.setPreferencesOpen(true)}
        onFocus={consent.warmPreferences}
        onPointerDown={consent.warmPreferences}
        onPointerEnter={consent.warmPreferences}
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
  const consent = useAnalyticsConsent((state) => state);

  if (!consent.isAvailable) {
    return null;
  }

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onClick={() => consent.setPreferencesOpen(true)}
      onFocus={consent.warmPreferences}
      onPointerEnter={consent.warmPreferences}
    >
      <HugeIcons icon={Analytics01Icon} />
      {t("manage")}
    </DropdownMenuItem>
  );
}

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
