import { Button } from "@repo/design-system/components/ui/button";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { Auth } from "@/components/auth";
import { FeaturesDithering } from "@/components/marketing/about/features.client";
import { Theme } from "@/components/marketing/shared/footer-action";
import { BackButton } from "@/components/shared/back-button";
import {
  getShellPageNavigation,
  type PageNavigation,
} from "@/lib/content/page/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(props: PageProps<"/[locale]/auth">) {
  const locale = getLocaleOrThrow((await props.params).locale);
  const pageNavigation = await getShellPageNavigation(locale);

  return (
    <main className="relative grid h-svh lg:grid-cols-7">
      <div className="col-span-3 flex flex-col gap-4 p-6 sm:p-12">
        <div className="flex items-center justify-between">
          <BackButton />

          <Theme variant="ghost" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <PageTitle />

          <Auth />

          <PageFooter locale={locale} pageNavigation={pageNavigation} />
        </div>
      </div>
      <div className="relative col-span-4 hidden lg:block">
        <FeaturesDithering />
      </div>
    </main>
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
