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

/** Renders the non-blocking first decision and permanent preferences dialog. */
export function AnalyticsConsentControls() {
  const t = useTranslations("AnalyticsConsent");
  const controller = useAnalyticsConsent((state) => state);

  if (!controller.isAvailable) {
    return null;
  }

  const shouldPrompt =
    controller.state.status === "prompt" ||
    (controller.error === "load" && controller.state.status === "pending");

  return (
    <>
      {shouldPrompt ? (
        <section
          aria-label={t("title")}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl sm:bottom-6"
        >
          <Card className="shadow-lg" size="sm">
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PrivacyPolicyLink />
              <ConsentAgeNotice />
              {controller.error ? (
                <ConsentError error={controller.error} />
              ) : null}
            </CardContent>
            <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                disabled={!controller.canDecline || controller.isSaving}
                onClick={() => controller.decide(false)}
                type="button"
                variant="outline"
              >
                {t("decline")}
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={!controller.canGrant || controller.isSaving}
                onClick={() => controller.decide(true)}
                type="button"
                variant="outline"
              >
                {t("allow")}
              </Button>
            </CardFooter>
          </Card>
        </section>
      ) : null}

      <ResponsiveDialog
        description={t("preferences-description")}
        footer={
          <>
            <Button
              disabled={!controller.canDecline || controller.isSaving}
              onClick={() => controller.decide(false)}
              type="button"
              variant="outline"
            >
              {t("decline")}
            </Button>
            <Button
              disabled={!controller.canGrant || controller.isSaving}
              onClick={() => controller.decide(true)}
              type="button"
              variant="outline"
            >
              {t("allow")}
            </Button>
          </>
        }
        open={controller.isPreferencesOpen}
        setOpen={controller.setPreferencesOpen}
        title={t("preferences-title")}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="font-medium text-sm">{t("current-choice")}</p>
            <p className="mt-1 text-muted-foreground text-sm">
              {t(`status-${controller.state.status}`)}
            </p>
          </div>
          <PrivacyPolicyLink />
          <ConsentAgeNotice />
          {controller.error ? <ConsentError error={controller.error} /> : null}
        </div>
      </ResponsiveDialog>
    </>
  );
}

function PrivacyPolicyLink() {
  const t = useTranslations("AnalyticsConsent");

  return (
    <p className="text-muted-foreground text-sm">
      {t.rich("policy", {
        "privacy-policy": (chunks) => (
          <NavigationLink
            className="text-foreground underline underline-offset-4"
            href="/privacy-policy"
          >
            {chunks}
          </NavigationLink>
        ),
      })}
    </p>
  );
}

function ConsentAgeNotice() {
  const t = useTranslations("AnalyticsConsent");

  return (
    <p className="mt-2 text-muted-foreground text-sm">
      {t("age-confirmation")}
    </p>
  );
}

function ConsentError({ error }: { error: "load" | "runtime" | "save" }) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <p className="flex items-start gap-2 text-destructive text-sm" role="alert">
      <HugeIcons className="mt-0.5" icon={Alert02Icon} />
      {t(`${error}-error`)}
    </p>
  );
}
