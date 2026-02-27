import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { HomeHeader } from "@/components/home/header";
import { InputSearch } from "@/components/search/input";
import { SearchListItems } from "@/components/search/results";

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
    <div
      className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh"
      data-pagefind-ignore
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-24">
        <div className="relative space-y-12">
          <HomeHeader />

          <div className="flex flex-col gap-6">
            <Suspense>
              <InputSearch />
            </Suspense>

            <Suspense>
              <SearchListItems />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
