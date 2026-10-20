import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { AuthLegalLinks } from "@/lib/auth/legal.fn";

/**
 * Shows the privacy and terms sentence of the sign-in pages, with links to the
 * two policy pages. The route loader reads the links on the server, and the
 * links name the main site's origin, so a relative link on a school host would
 * reach the school instead.
 */
export function AuthLegal({
  links,
}: {
  readonly links: AuthLegalLinks | null;
}) {
  const t = useTranslations("Legal");
  if (links === null) {
    return null;
  }

  return (
    <div className="flex max-w-sm flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {t.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <LegalLink href={links.terms}>{chunks}</LegalLink>
          ),
          "privacy-policy": (chunks) => (
            <LegalLink href={links.privacy}>{chunks}</LegalLink>
          ),
        })}
      </p>
    </div>
  );
}

/**
 * Opens one policy page in a new tab, as a text link inside the sentence, so the words
 * around it keep their own spacing. It is a plain anchor, so assistive technology names
 * it a link.
 */
function LegalLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="font-medium text-foreground underline-offset-4 hover:underline"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
