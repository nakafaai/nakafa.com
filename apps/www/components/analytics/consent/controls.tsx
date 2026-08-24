"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { useTranslations } from "next-intl";
import { useAnalyticsConsent } from "@/lib/analytics/consent/context";
import { usePageNavigation } from "@/lib/content/page/context";

/** Renders the non-blocking first decision and permanent preferences dialog. */
export function AnalyticsConsentControls() {
  const t = useTranslations("AnalyticsConsent");
  const isAvailable = useAnalyticsConsent((state) => state.isAvailable);
  const isPreferencesOpen = useAnalyticsConsent(
    (state) => state.isPreferencesOpen
  );
  const setPreferencesOpen = useAnalyticsConsent(
    (state) => state.setPreferencesOpen
  );
  const isPromptOpen = useAnalyticsConsent((state) => state.isPromptOpen);

  if (!isAvailable) {
    return null;
  }

  return (
    <>
      {isPromptOpen ? (
        <section
          aria-label={t("title")}
          className="fixed right-4 bottom-4 left-4 z-50 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-md"
        >
          <Card className="max-h-[calc(100dvh-2rem)] shadow-lg" size="sm">
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("prompt-description")}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              <ConsentDetails />
            </CardContent>
            <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-end max-sm:[&>[data-slot=button]]:w-full">
              <ConsentActions />
            </CardFooter>
          </Card>
        </section>
      ) : null}

      <ResponsiveDialog
        description={<ConsentStatus />}
        footer={<ConsentActions />}
        open={isPreferencesOpen}
        setOpen={setPreferencesOpen}
        title={t("title")}
      >
        <div className="flex flex-col gap-3">
          <ConsentDetails />
        </div>
      </ResponsiveDialog>
    </>
  );
}

function ConsentStatus() {
  const t = useTranslations("AnalyticsConsent");
  const status = useAnalyticsConsent((state) => state.status);

  return <span aria-live="polite">{t(`status-${status}`)}</span>;
}

function ConsentActions() {
  const t = useTranslations("AnalyticsConsent");
  const canDecline = useAnalyticsConsent((state) => state.canDecline);
  const canGrant = useAnalyticsConsent((state) => state.canGrant);
  const decide = useAnalyticsConsent((state) => state.decide);
  const isSaving = useAnalyticsConsent((state) => state.isSaving);

  return (
    <>
      <Button
        disabled={!canDecline || isSaving}
        onClick={() => decide(false)}
        type="button"
        variant="outline"
      >
        {t("decline")}
      </Button>
      <Button
        disabled={!canGrant || isSaving}
        onClick={() => decide(true)}
        type="button"
      >
        {t("allow")}
      </Button>
    </>
  );
}

function ConsentDetails() {
  const t = useTranslations("AnalyticsConsent");
  const error = useAnalyticsConsent((state) => state.error);

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
      <PrivacyPolicyLink />
      {error ? <ConsentError error={error} /> : null}
    </>
  );
}

function PrivacyPolicyLink() {
  const t = useTranslations("AnalyticsConsent");
  const href = usePageNavigation(
    (navigation) => navigation?.privacyPolicyHref ?? null
  );

  if (!href) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {t.rich("policy", {
        "privacy-policy": (chunks) => (
          <NavigationLink
            className="text-foreground underline underline-offset-4"
            href={href}
          >
            {chunks}
          </NavigationLink>
        ),
      })}
    </p>
  );
}

function ConsentError({ error }: { error: "load" | "runtime" | "save" }) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <p className="flex items-start gap-2 text-destructive text-sm" role="alert">
      <HugeIcons className="mt-0.5 size-4 shrink-0" icon={Alert02Icon} />
      {t(`${error}-error`)}
    </p>
  );
}
