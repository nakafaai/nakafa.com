import { askSeo } from "@repo/seo/ask";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";

export const revalidate = false;

const askData = askSeo();

type Props = {
  params: Promise<{
    locale: Locale;
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, slug } = await params;

  const seoData = askData.find((data) => data.slug === slug);

  if (!seoData) {
    return {};
  }

  const title = seoData.locales[locale].title;
  const description = seoData.locales[locale].description;

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: `/${locale}/ask/${slug}`,
    },
    keywords: title
      .split(" ")
      .concat(description.split(" "))
      .filter((keyword) => keyword.length > 0),
  };
}

export function generateStaticParams() {
  return askData.map((data) => ({
    slug: data.slug,
  }));
}

export default async function Page({ params }: Props) {
  const { slug } = await params;

  const seoData = askData.find((data) => data.slug === slug);

  if (!seoData) {
    notFound();
  }

  return null;
}
