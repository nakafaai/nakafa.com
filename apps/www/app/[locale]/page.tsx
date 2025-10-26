import { Particles } from "@repo/design-system/components/ui/particles";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HomeSearch } from "@/components/home/search";
import { HomeTitle } from "@/components/home/title";
import { Weather } from "@/components/home/weather";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;

  const [tHome, tCommon] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
  ]);

  setRequestLocale(locale);

  return (
    <>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
