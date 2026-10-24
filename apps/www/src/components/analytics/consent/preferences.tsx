import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "use-intl";
import {
  ConsentActions,
  ConsentDetails,
} from "@/components/analytics/consent/details";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";

/**
 * The permanent preferences dialog. The first intent to open it (hover, focus,
 * or press) mounts this component, and it stays mounted afterwards. A quick
 * touch tap can open the dialog before its chunk arrives, so on a slow
 * connection that first open waits for the chunk instead of appearing at once.
 */
export function ConsentPreferences({
  consent,
}: {
  consent: AnalyticsConsentContextValue;
}) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <ResponsiveDialog
      description={t(`status-${consent.preferences.statusAtOpen}`)}
      footer={
        <ConsentActions
          canDecline={consent.canDecline}
          canGrant={consent.canGrant}
          decide={consent.decide}
        />
      }
      open={consent.preferences.isOpen}
      setOpen={consent.setPreferencesOpen}
      title={t("title")}
    >
      <div className="flex flex-col gap-3">
        <ConsentDetails error={consent.error} />
      </div>
    </ResponsiveDialog>
  );
}
