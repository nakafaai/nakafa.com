import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Auth } from "@/components/auth";
import { Theme } from "@/components/marketing/shared/footer-action";
import { BackButton } from "@/components/shared/back-button";
import {
  EntryShell,
  EntryShellArtwork,
  EntryShellBody,
  EntryShellHeader,
  EntryShellPanel,
} from "@/components/shared/entry-shell";
import {
  getShellPageNavigation,
  type PageNavigation,
} from "@/lib/content/page/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(props: PageProps<"/[locale]/auth">) {
  const locale = getLocaleOrThrow((await props.params).locale);
  const pageNavigation = await getShellPageNavigation(locale);

  return (
    <EntryShell>
      <EntryShellPanel>
        <EntryShellHeader>
          <BackButton />

          <Theme variant="ghost" />
        </EntryShellHeader>
        <EntryShellBody>
          <PageTitle />

          <Suspense fallback={null}>
            <Auth />
          </Suspense>

          <PageFooter locale={locale} pageNavigation={pageNavigation} />
        </EntryShellBody>
      </EntryShellPanel>
      <EntryShellArtwork />
    </EntryShell>
  );
}

function PageTitle() {
  const t = useTranslations("Metadata");

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-semibold text-2xl">Nakafa</h1>
      <p className="text-muted-foreground">{t("very-short-description")}</p>
    </div>
  );
}

function PageFooter({
  locale,
  pageNavigation,
}: {
  locale: Locale;
  pageNavigation: PageNavigation | null;
}) {
  const tLegal = useTranslations("Legal");

  if (!pageNavigation) {
    return null;
  }

  return (
    <div className="flex max-w-sm flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {tLegal.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <Button
              className="h-auto p-0"
              nativeButton={false}
              render={
                <a
                  href={`/${locale}${pageNavigation.termsOfServiceHref}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </a>
              }
              size="sm"
              variant="link"
            />
          ),
          "privacy-policy": (chunks) => (
            <Button
              className="h-auto p-0"
              nativeButton={false}
              render={
                <a
                  href={`/${locale}${pageNavigation.privacyPolicyHref}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </a>
              }
              size="sm"
              variant="link"
            />
          ),
        })}
      </p>
    </div>
  );
}
