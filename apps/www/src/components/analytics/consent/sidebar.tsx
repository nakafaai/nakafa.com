import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useTranslations } from "use-intl";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";
import { useVisitorAnalyticsConsentModel } from "@/lib/analytics/consent/context";

/**
 * Keeps privacy preferences reachable for signed-out sidebar visitors. It reads the
 * anonymous consent state, so the visitor's guest card reads no account.
 */
export function VisitorConsentSidebarItem() {
  const { value } = useVisitorAnalyticsConsentModel();
  return <AnalyticsConsentSidebarItem consent={value} />;
}

/** The privacy preferences item of the sidebar for the given consent state. */
function AnalyticsConsentSidebarItem({
  consent,
}: {
  consent: AnalyticsConsentContextValue;
}) {
  const t = useTranslations("AnalyticsConsent");

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
