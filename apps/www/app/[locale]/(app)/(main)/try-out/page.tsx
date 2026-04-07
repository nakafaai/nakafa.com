import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Effect } from "effect";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { TryoutHubPage } from "@/components/tryout/hub-page";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const { tCommon, tTryouts } = await Effect.runPromise(
    Effect.all(
      {
        tCommon: Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Common" }),
          catch: () => new Error("Failed to load common translations"),
        }),
        tTryouts: Effect.tryPromise({
          try: () => getTranslations({ locale, namespace: "Tryouts" }),
          catch: () => new Error("Failed to load tryout translations"),
        }),
      },
      {
        concurrency: "unbounded",
      }
    )
  );

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

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <div className="min-h-svh" data-pagefind-ignore>
        <TryoutHubPage locale={locale} />
      </div>
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
