import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import TermsOfServiceEn from "./en.mdx";
import TermsOfServiceId from "./id.mdx";

const contentByLocale = {
  en: TermsOfServiceEn,
  id: TermsOfServiceId,
} satisfies Record<Locale, ComponentType>;

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/terms-of-service">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Legal" });
  const path = `/${locale}/terms-of-service`;

  return {
    title: t("terms-of-service"),
    description: t("terms-of-service-description"),
    alternates: createLocalizedAlternates(path),
  };
}

export default function Page(props: PageProps<"/[locale]/terms-of-service">) {
  const { params } = props;
  const locale = getLocaleOrThrow(use(params).locale);

  return <PageContent locale={locale} />;
}

async function PageContent({ locale }: { locale: Locale }) {
  const Content = contentByLocale[locale];

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Content />
    </main>
  );
}
