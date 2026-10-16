"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { ANALYTICS_CONSENT_ROOT_ATTRIBUTE } from "@repo/analytics/consent";
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
import {
  type AnalyticsConsentContextValue,
  useAnalyticsConsent,
} from "@/lib/analytics/consent/context";
import { usePageNavigation } from "@/lib/content/page/context";

/** Names the prompt section, so the hide rules below can match it. */
const PROMPT_ATTRIBUTE = "data-analytics-consent-prompt";
const promptAttributes = { [PROMPT_ATTRIBUTE]: "" };

/**
 * Hides the prompt while the document root carries the mark that the bootstrap
 * writes before paint. The root attribute's name comes from the shared consent
 * module, so this rule cannot drift from the script.
 */
const HIDE_PROMPT_WHILE_MARKED = `:root[${ANALYTICS_CONSENT_ROOT_ATTRIBUTE}] [${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * Hides the prompt where scripts are off. Nothing runs there to record a choice,
 * so the buttons could never work.
 */
const HIDE_PROMPT_WITHOUT_SCRIPTS = `[${PROMPT_ATTRIBUTE}]{display:none}`;

/**
 * Renders the non-blocking first decision and permanent preferences dialog.
 *
 * The server renders the prompt while the choice is pending, so the text is in
 * the first HTML. The bootstrap script marks the root before paint for a visitor
 * whose choice this browser keeps, and the store removes the mark once it knows
 * the choice. Without scripts the prompt stays hidden.
 *
 * The consent state is derived once here and handed to the decision and
 * detail parts, which render in both the prompt and the dialog.
 */
export function AnalyticsConsentControls() {
  const t = useTranslations("AnalyticsConsent");
  const consent = useAnalyticsConsent((state) => state);

  if (!consent.isAvailable) {
    return null;
  }

  const actions = (
    <ConsentActions
      canDecline={consent.canDecline}
      canGrant={consent.canGrant}
      decide={consent.decide}
      isSaving={consent.isSaving}
    />
  );

  return (
    <>
      <style>{HIDE_PROMPT_WHILE_MARKED}</style>
      <noscript>
        <style>{HIDE_PROMPT_WITHOUT_SCRIPTS}</style>
      </noscript>
      {consent.isPromptOpen ? (
        <section
          {...promptAttributes}
          aria-label={t("title")}
          className="fixed right-4 bottom-4 left-4 z-50 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full sm:max-w-md"
        >
          <Card className="max-h-[calc(100dvh-2rem)] shadow-lg" size="sm">
            <CardHeader>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("prompt-description")}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              <ConsentDetails error={consent.error} />
            </CardContent>
            <CardFooter className="flex-col gap-2 sm:flex-row sm:justify-end max-sm:[&>[data-slot=button]]:w-full">
              {actions}
            </CardFooter>
          </Card>
        </section>
      ) : null}

      <ResponsiveDialog
        description={t(`status-${consent.preferences.statusAtOpen}`)}
        footer={actions}
        open={consent.preferences.isOpen}
        setOpen={consent.setPreferencesOpen}
        title={t("title")}
      >
        <div className="flex flex-col gap-3">
          <ConsentDetails error={consent.error} />
        </div>
      </ResponsiveDialog>
    </>
  );
}

function ConsentActions({
  canDecline,
  canGrant,
  decide,
  isSaving,
}: Pick<
  AnalyticsConsentContextValue,
  "canDecline" | "canGrant" | "decide" | "isSaving"
>) {
  const t = useTranslations("AnalyticsConsent");

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

function ConsentDetails({
  error,
}: Pick<AnalyticsConsentContextValue, "error">) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <>
      <p className="text-muted-foreground text-sm">{t("description")}</p>
      <PrivacyPolicyLink />
      {error ? <ConsentError error={error} /> : null}
    </>
  );
}

/**
 * Links the privacy policy without prefetching it, as every signed Page link
 * must (see `PageNavigation`). This prompt opens on every first visit.
 */
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
            prefetch={false}
          >
            {chunks}
          </NavigationLink>
        ),
      })}
    </p>
  );
}

function ConsentError({
  error,
}: {
  error: NonNullable<AnalyticsConsentContextValue["error"]>;
}) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <p className="flex items-start gap-2 text-destructive text-sm" role="alert">
      <HugeIcons className="mt-0.5 size-4 shrink-0" icon={Alert02Icon} />
      {t(`${error}-error`)}
    </p>
  );
}
