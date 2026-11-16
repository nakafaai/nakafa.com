import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import { showConsentChoices } from "@/lib/ads/consent";
import { useAnalyticsConsent } from "@/lib/analytics/consent";

/**
 * Whether the visitor has choices to change: Google's consent message asks them,
 * as it does where a privacy law applies. Elsewhere it asks nothing, so the page
 * offers nothing to reopen.
 */
function useHasChoices() {
  return useAnalyticsConsent((consent) => consent.asks);
}

/** The menu item that opens Google's consent message again, where the visitor changes or withdraws their choices. */
export function PrivacyChoicesMenuItem() {
  const t = useTranslations("AnalyticsConsent");
  if (!useHasChoices()) {
    return null;
  }
  return (
    <DropdownMenuItem icon={Analytics01Icon} onClick={showConsentChoices}>
      {t("title")}
    </DropdownMenuItem>
  );
}

/** The footer's button that opens Google's consent message again. */
export function PrivacyChoicesFooterItem() {
  const t = useTranslations("AnalyticsConsent");
  if (!useHasChoices()) {
    return null;
  }
  return (
    <Button onClick={showConsentChoices} type="button">
      <HugeIcons icon={Analytics01Icon} />
      {t("title")}
    </Button>
  );
}
