import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/terms-of-service">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Legal" });

  return {
    title: t("terms-of-service"),
    description: t("terms-of-service-description"),
    alternates: {
      canonical: `/${locale}/terms-of-service`,
    },
  };
}

export default function Page(props: PageProps<"/[locale]/terms-of-service">) {
  const { params } = props;
  const locale = getLocaleOrThrow(use(params).locale);

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
