import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });

  return {
    title: t("security-policy"),
    alternates: {
      canonical: `/${locale}/security-policy`,
    },
  };
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <PageContent locale={locale} />;
}

async function PageContent({ locale }: { locale: Locale }) {
  try {
    const { default: Content } = await import(`./${locale}.mdx`);

    if (!Content) {
      notFound();
    }

    return (
      <main className="mx-auto max-w-3xl px-6 py-20" data-pagefind-ignore>
        <Content />
      </main>
    );
  } catch {
    notFound();
  }
}
