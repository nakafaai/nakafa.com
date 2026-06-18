import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { InputSearch } from "@/components/search/input";
import { SearchListItems } from "@/components/search/results";
import { BackButton } from "@/components/shared/back-button";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

/** Builds localized search metadata while keeping the page body first for AFDocs content-start checks. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/search">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Utils" });
  const path = `/${locale}/search`;

  return {
    title: t("search-title"),
    description: t("search-description"),
    alternates: createLocalizedAlternates(path),
  };
}

/** Renders search with the input first so people and agents reach the primary task immediately. */
export default async function Page({ params }: PageProps<"/[locale]/search">) {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Utils" });

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <div className="mx-auto w-full max-w-3xl px-6 py-24">
        <div className="relative space-y-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-pretty font-medium text-4xl tracking-tight">
              {t("search-title")}
            </h1>
          </div>

          <div className="flex flex-col gap-2">
            <BackButton
              className="w-fit p-0 text-muted-foreground"
              defaultHref="/home"
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
