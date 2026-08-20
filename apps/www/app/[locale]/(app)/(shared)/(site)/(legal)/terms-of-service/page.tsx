import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import { use } from "react";
import { getActiveLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import TermsOfServiceEn from "./en.mdx";
import TermsOfServiceId from "./id.mdx";

const contentByLocale = {
  en: TermsOfServiceEn,
  id: TermsOfServiceId,
} satisfies Record<ActiveAppLocaleCode, ComponentType>;

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/terms-of-service">["params"];
}): Promise<Metadata> {
  const locale = getActiveLocaleOrThrow((await params).locale);
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
  const locale = getActiveLocaleOrThrow(use(params).locale);

  return <PageContent locale={locale} />;
}

async function PageContent({ locale }: { locale: ActiveAppLocaleCode }) {
  "use cache";
  cacheLife("hours");

  const Content = contentByLocale[locale];

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Content />
    </main>
  );
}
