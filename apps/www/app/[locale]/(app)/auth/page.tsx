import { Button } from "@repo/design-system/components/ui/button";
import { type Locale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Auth } from "@/components/auth";
import { FeaturesDithering } from "@/components/marketing/about/features.client";
import { Theme } from "@/components/marketing/shared/footer-action";
import { BackButton } from "@/components/shared/back-button";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <main className="relative grid h-svh lg:grid-cols-7" data-pagefind-ignore>
      <div className="col-span-3 flex flex-col gap-4 p-6 sm:p-12">
        <div className="flex items-center justify-between">
          <BackButton />

          <Theme variant="ghost" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <PageTitle />

          <Auth />

          <PageFooter />
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

function PageFooter() {
  const tLegal = useTranslations("Legal");

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
                  href="/terms-of-service"
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
                  href="/privacy-policy"
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
