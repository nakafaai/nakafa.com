import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { TryoutHubPage } from "@/components/tryout/hub-page";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/try-out">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);

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
  const locale = getLocaleOrThrow(use(props.params).locale);

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <TryoutHubPage locale={locale} />
    </>
  );
}

function PageBreadcrumb({ locale }: { locale: Locale }) {
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
