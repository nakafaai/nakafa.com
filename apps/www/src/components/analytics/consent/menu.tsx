import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import {
  type AnalyticsConsentContextValue,
  useVisitorAnalyticsConsentModel,
} from "@/lib/analytics/consent/context";
import { useAnalyticsConsent } from "@/lib/analytics/consent/facts";

/** The privacy preference row of a menu, for the consent state the menu reads. */
function PreferencesMenuItem({
  consent,
}: {
  consent: AnalyticsConsentContextValue;
}) {
  const t = useTranslations("AnalyticsConsent");

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

/** The privacy preference row of a signed-in account's menu, read from the account's consent. */
export function AnalyticsConsentMenuItem() {
  const consent = useAnalyticsConsent((state) => state);

  return <PreferencesMenuItem consent={consent} />;
}

/**
 * The privacy preference row of a visitor's menu. It reads the anonymous consent
 * state, so a visitor's page loads no account and no Convex client.
 */
export function VisitorConsentMenuItem() {
  const { value } = useVisitorAnalyticsConsentModel();

  return <PreferencesMenuItem consent={value} />;
}
