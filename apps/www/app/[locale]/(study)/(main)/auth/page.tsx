import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import { type Locale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Auth } from "@/components/auth";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <main
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto max-w-lg px-6">
        <div className="relative flex h-full flex-col items-center gap-6">
          <PageTitle />

          <Auth />

          <PageFooter />
        </div>
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
    <div className="flex flex-col">
      <p className="text-balance text-center text-muted-foreground text-sm">
        {tLegal.rich("legal-description", {
          "terms-of-service": (chunks) => (
            <Button asChild className="h-auto p-0" size="sm" variant="link">
              <NavigationLink href="/terms-of-service">{chunks}</NavigationLink>
            </Button>
          ),
          "privacy-policy": (chunks) => (
            <Button asChild className="h-auto p-0" size="sm" variant="link">
              <NavigationLink href="/privacy-policy">{chunks}</NavigationLink>
            </Button>
          ),
        })}
      </p>
    </div>
  );
}
