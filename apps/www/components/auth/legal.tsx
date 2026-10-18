import { buttonVariants } from "@repo/design-system/lib/button";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Shows the privacy and terms sentence of the sign-in pages, with links to the
 * two policy pages. Those pages live on the main site, so the links name its
 * origin: a relative link on a school host would reach the school instead.
 */
export async function AuthLegal() {
  const locale = getLocaleOrThrow(await getLocale());
  const pageNavigation = await getShellPageNavigation(locale);
  if (!pageNavigation) {
    return null;
  }

  const t = await getTranslations("Legal");
  const termsHref = new URL(
    `/${locale}${pageNavigation.termsOfServiceHref}`,
    SITE_ORIGIN
  ).href;
  const privacyHref = new URL(
    `/${locale}${pageNavigation.privacyPolicyHref}`,
    SITE_ORIGIN
  ).href;

  return (
    <div className="flex max-w-sm flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {t.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <LegalLink href={termsHref}>{chunks}</LegalLink>
          ),
          "privacy-policy": (chunks) => (
            <LegalLink href={privacyHref}>{chunks}</LegalLink>
          ),
        })}
      </p>
    </div>
  );
}

/**
 * Opens one policy page in a new tab, with the look of a text link. It is a
 * plain anchor, so assistive technology names it a link, not a button.
 */
function LegalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className={buttonVariants({
        className: "h-auto p-0",
        size: "sm",
        variant: "link",
      })}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
