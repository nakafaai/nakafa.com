import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { HomeHeader } from "@/components/home/header";
import { InputSearch } from "@/components/search/input";
import { SearchListItems } from "@/components/search/results";
import { BackButton } from "@/components/shared/back-button";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/search">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Utils" });

  return {
    title: t("search-title"),
    description: t("search-description"),
    alternates: {
      canonical: `/${locale}/search`,
    },
  };
}

export default function Page(props: PageProps<"/[locale]/search">) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

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

          <div className="flex flex-col gap-2">
            <BackButton
              className="w-fit p-0 text-muted-foreground"
              defaultHref="/"
              variant="link"
            />

            <div className="grid gap-6">
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
    </div>
  );
}
