import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { redirect } from "next/navigation";
import { type Locale, useTranslations } from "next-intl";

import { Suspense, use } from "react";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(props: PageProps<"/[locale]">) {
  const { params, searchParams } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <div
        className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh"
        data-pagefind-ignore
      >
        <Suspense>
          <Main searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Main({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]">["searchParams"];
}) {
  const [searchParamsValue, token] = await Promise.all([
    searchParams,
    getToken(),
  ]);
  const from =
    typeof searchParamsValue?.from === "string"
      ? searchParamsValue.from
      : undefined;

  // If no user token and from about page, goes to auth
  if (!token && from === "/about") {
    redirect("/auth");
  }

  // if just no user token
  if (!token) {
    redirect("/about");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative space-y-12">
        <HomeHeader />

        <HomeExplore />

        <HomeContinueLearning />

        <HomeTrending />
      </div>
    </div>
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
          position: 1,
          name: tHome("title"),
          item: `https://nakafa.com/${locale}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: tCommon("subject"),
          item: `https://nakafa.com/${locale}/subject`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: tCommon("articles"),
          item: `https://nakafa.com/${locale}/articles`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: tCommon("contributor"),
          item: `https://nakafa.com/${locale}/contributor`,
        },
      ]}
    />
  );
}
