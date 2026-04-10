import { routing } from "@repo/internationalization/src/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";

export async function generateMetadata({
  params,
}: {
  params: LayoutProps<"/[locale]/school">["params"];
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({
    locale,
    namespace: "Metadata",
  });

  return {
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [
        {
          url: "/nakafa-school.png",
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
      creator: "@nabilfatih_",
      site: "@nabilfatih_",
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: `https://nakafa.com/${locale}/school`,
      siteName: "Nakafa School",
      locale,
      type: "website",
      images: [
        {
          url: "/nakafa-school.png",
          alt: t("title"),
          width: 1200,
          height: 630,
        },
      ],
    },
  };
}

/** Renders the school subtree after locale and metadata setup. */
export default function Layout(props: LayoutProps<"/[locale]/school">) {
  const { children, params } = props;
  const { locale } = use(params);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return children;
}
