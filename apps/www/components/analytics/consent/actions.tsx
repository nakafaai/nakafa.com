"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
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
