import { AllahIcon } from "@hugeicons/core-free-icons";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { Link } from "@repo/internationalization/src/navigation";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";

export const revalidate = false;

interface Params {
  locale: Locale;
}

interface Props {
  params: Promise<Params>;
}

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: "Holy" });

  const path = `/${locale}/quran`;

  const alternates = {
    canonical: path,
  };
  const image = {
    url: "/quran.png",
    width: 1200,
    height: 630,
  };
  const twitter: Metadata["twitter"] = {
    images: [image],
  };
  const openGraph: Metadata["openGraph"] = {
    url: path,
    images: [image],
    type: "book",
    siteName: "Nakafa",
    locale,
  };

  const title = t("quran");
  const description = t("quran-description");

  return {
    title,
    description,
    alternates,
    category: t("quran"),
    twitter,
    openGraph,
  };
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <PageContent locale={locale} />;
}

function PageContent({ locale }: { locale: Locale }) {
  const t = useTranslations("Holy");

  const surahs = getAllSurah();

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={surahs.map((surah, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}/quran/${surah.number}`,
          position: index + 1,
          name: getSurahName({ locale, name: surah.name }),
          item: `https://nakafa.com/${locale}/quran/${surah.number}`,
        }))}
      />
      <HeaderContent
        description={t("quran-description")}
        icon={AllahIcon}
        title={t("quran")}
      />
      <LayoutContent>
        <div className="overflow-hidden rounded-xl border shadow-sm">
          {surahs.map((surah) => {
            const title = getSurahName({ locale, name: surah.name });
            return (
              <Link
                className="group flex w-full scroll-mt-28 items-center gap-2 border-t px-6 py-4 transition-colors ease-out first:border-t-0 first:pt-5 last:pb-5 hover:bg-accent hover:text-accent-foreground"
                href={`/quran/${surah.number}`}
                key={surah.number}
                prefetch
                title={title}
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
                      <span className="font-mono text-xs tracking-tighter">
                        {surah.number}
                      </span>
                    </div>
                    <h2>{title}</h2>
                  </div>

                  <p className="font-quran text-xl" dir="rtl">
                    {surah.name.short}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </LayoutContent>
      <FooterContent>
        <RefContent />
      </FooterContent>
    </>
  );
}
