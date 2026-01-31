import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { HomeTitle } from "@/components/home/title";
import { InputSearch } from "@/components/search/input";
import { SearchListItems } from "@/components/search/results";
import { FooterContent } from "@/components/shared/footer-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Utils" });

  return {
    title: t("search-title"),
    description: t("search-description"),
    alternates: {
      canonical: `/${locale}/search`,
    },
  };
}

export default function Page({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <div
        className="relative min-h-[calc(100svh-4rem)] py-10 lg:min-h-svh lg:py-26"
        data-pagefind-ignore
      >
        <div className="mx-auto w-full max-w-xl px-6">
          <HomeTitle />
        </div>
        <div className="sticky top-20 z-10 sm:top-10">
          <div className="mx-auto w-full max-w-3xl px-6">
            <Suspense>
              <InputSearch />
            </Suspense>
          </div>
        </div>
        <div className="mx-auto mt-8 w-full max-w-3xl px-6">
          <Suspense>
            <SearchListItems />
          </Suspense>
        </div>
      </div>
      <FooterContent>
        <RefContent
          githubUrl={getGithubUrl({
            path: encodeURI("/app/[locale]/search"),
          })}
        />
      </FooterContent>
    </>
  );
}
