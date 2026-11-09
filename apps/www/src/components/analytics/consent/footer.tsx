import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";

/**
 * The footer's usage data preference, a control beside the language and the theme in their group: the menu's
 * icon and its label, so the footer's links stay links and its preferences stay buttons.
 */
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
    <Button
      onClick={() => consent.setPreferencesOpen(true)}
      onFocus={consent.warmPreferences}
      onPointerDown={consent.warmPreferences}
      onPointerEnter={consent.warmPreferences}
      type="button"
    >
      <HugeIcons icon={Analytics01Icon} />
      {t("manage")}
    </Button>
  );
}
