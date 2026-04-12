import { routing } from "@repo/internationalization/src/routing";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { TryoutHubPage } from "@/components/tryout/hub-page";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/try-out">["params"];
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [tCommon, tTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
  ]);

  const path = `/${locale}/try-out`;
  const title = tCommon("try-out");
  const description = tTryouts("description");

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Nakafa",
      locale,
      type: "website",
    },
  };
}

export default function Page(props: PageProps<"/[locale]/try-out">) {
  const { params } = props;
  const { locale } = use(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <div className="min-h-svh">
        <TryoutHubPage locale={locale} />
      </div>
    </>
  );
}

function PageBreadcrumb({
  locale,
}: {
  locale: Awaited<PageProps<"/[locale]/try-out">["params"]>["locale"];
}) {
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbJsonLd
      breadcrumbItems={[
        {
          "@type": "ListItem",
          position: 1,
          name: tCommon("home"),
          item: `https://nakafa.com/${locale}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: tCommon("try-out"),
          item: `https://nakafa.com/${locale}/try-out`,
        },
      ]}
    />
  );
}
