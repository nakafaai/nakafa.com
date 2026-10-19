"use client";

import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "next-intl";
import {
  ConsentActions,
  ConsentDetails,
} from "@/components/analytics/consent/details";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";

/**
 * The permanent preferences dialog. The first intent to open it mounts this
 * component, and it stays mounted afterwards, so the first open shows no
 * loading frame.
 */
export function ConsentPreferences() {
  const t = useTranslations("AnalyticsConsent");
  const consent = useAnalyticsConsent((state) => state);

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
