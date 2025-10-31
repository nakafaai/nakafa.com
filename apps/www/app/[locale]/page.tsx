import { Particles } from "@repo/design-system/components/ui/particles";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { type Locale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { HomeSearch } from "@/components/home/search";
import { HomeTitle } from "@/components/home/title";
import { Videos } from "@/components/home/videos";
import { Weather } from "@/components/home/weather";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <div
        className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center lg:min-h-svh"
        data-pagefind-ignore
      >
        <Particles className="pointer-events-none absolute inset-0 opacity-80" />
        <div className="mx-auto w-full max-w-xl px-6">
          <div className="relative flex h-full flex-col space-y-4">
            <HomeTitle />

            <HomeSearch />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Weather />
              <Videos />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PageBreadcrumb({ locale }: { locale: Locale }) {
  const tHome = useTranslations("Home");
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbJsonLd
      breadcrumbItems={[
        {
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}`,
          position: 1,
          name: tHome("title"),
          item: `https://nakafa.com/${locale}`,
        },
        {
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}/subject`,
          position: 2,
          name: tCommon("subject"),
          item: `https://nakafa.com/${locale}/subject`,
        },
        {
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}/articles`,
          position: 3,
          name: tCommon("articles"),
          item: `https://nakafa.com/${locale}/articles`,
        },
        {
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}/contributor`,
          position: 4,
          name: tCommon("contributor"),
          item: `https://nakafa.com/${locale}/contributor`,
        },
      ]}
      locale={locale}
    />
  );
}
