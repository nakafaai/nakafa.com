import { Alert02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Link } from "@repo/internationalization/src/navigation";
import { useTranslations } from "use-intl";
import type { AnalyticsConsentContextValue } from "@/lib/analytics/consent/context";
import { usePageNavigation } from "@/lib/content/page/context";

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

/** The consent description, the privacy policy link, and the error, if any. */
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
 * Links the privacy policy without prefetching it, as every signed Page link
 * must (see `PageNavigation`). This prompt opens on every first visit.
 *
 * The server renders this link in the root layout, outside every `Suspense`,
 * so it is a plain localized `Link`: `NavigationLink` reads the pathname, which
 * blocks the prerender of a dynamic route such as `/[locale]/chat/[id]`.
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
          <Link
            className="text-foreground underline underline-offset-4"
            href={href}
            preload={false}
          >
            {chunks}
          </Link>
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
