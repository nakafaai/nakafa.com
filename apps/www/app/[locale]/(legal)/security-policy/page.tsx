import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Legal");

  return {
    title: t("security-policy"),
    alternates: {
      canonical: `/${locale}/security-policy`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;

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
