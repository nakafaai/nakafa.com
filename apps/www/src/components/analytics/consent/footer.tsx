import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "use-intl";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";

/** Adds a permanent privacy preference action to the marketing footer. */
export function AnalyticsConsentFooterItem({
  consent,
}: {
  consent: AnalyticsConsentContextValue;
}) {
  const t = useTranslations("AnalyticsConsent");

  if (!consent.isAvailable) {
    return null;
  }

  return (
    <li>
      <Button
        onClick={() => consent.setPreferencesOpen(true)}
        onFocus={consent.warmPreferences}
        onPointerDown={consent.warmPreferences}
        onPointerEnter={consent.warmPreferences}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("manage")}
      </Button>
    </li>
  );
}
