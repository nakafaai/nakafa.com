"use client";

import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import { useAnalyticsConsent } from "@/lib/analytics/consent/account.client";

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
