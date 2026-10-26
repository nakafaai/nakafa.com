import { Alert02Icon } from "@hugeicons/core-free-icons";
import {
  Alert,
  AlertDescription,
} from "@repo/design-system/components/ui/alert";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "use-intl";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";
import { usePageNavigation } from "@/lib/content/page/context";
import { PublicPathLink } from "@/lib/routing/public/link";

/** The decline and allow buttons, shared by the first prompt and the preferences dialog. */
export function ConsentActions({
  canDecline,
  canGrant,
  decide,
}: Pick<AnalyticsConsentContextValue, "canDecline" | "canGrant" | "decide">) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <>
      <Button
        disabled={!canDecline}
        onClick={() => decide(false)}
        type="button"
        variant="outline"
      >
        {t("decline")}
      </Button>
      <Button disabled={!canGrant} onClick={() => decide(true)} type="button">
        {t("allow")}
      </Button>
    </>
  );
}

/**
 * The consent body: one sentence on what sharing allows, the privacy policy line
 * with who may allow it, and the error, if any, in one sentence of its own.
 */
export function ConsentDetails({
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
 * Links the privacy policy. This prompt opens on every first visit. The link
 * never preloads, as no signed Page link does (see `PageNavigation`).
 *
 * The server renders this link in the root layout, outside every `Suspense`,
 * so the link must render on the server with the locale of the route.
 */
function PrivacyPolicyLink() {
  const t = useTranslations("AnalyticsConsent");
  const publicPath = usePageNavigation(
    (navigation) => navigation?.privacyPolicyPath ?? null
  );

  if (!publicPath) {
    return null;
  }

  return (
    <p className="text-muted-foreground text-sm">
      {t.rich("policy", {
        "privacy-policy": (chunks) => (
          <PublicPathLink
            className="text-foreground underline underline-offset-4"
            preload={false}
            publicPath={publicPath}
          >
            {chunks}
          </PublicPathLink>
        ),
      })}
    </p>
  );
}

/** The failed load, save or update of the choice, in one sentence that says what stays. */
function ConsentError({
  error,
}: {
  error: NonNullable<AnalyticsConsentContextValue["error"]>;
}) {
  const t = useTranslations("AnalyticsConsent");

  return (
    <Alert variant="destructive">
      <HugeIcons icon={Alert02Icon} />
      <AlertDescription>{t(`${error}-error`)}</AlertDescription>
    </Alert>
  );
}
