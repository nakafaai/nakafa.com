import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import SecurityPolicyDe from "./de.mdx";
import SecurityPolicyEn from "./en.mdx";
import SecurityPolicyId from "./id.mdx";

const contentByLocale = {
  de: SecurityPolicyDe,
  en: SecurityPolicyEn,
  id: SecurityPolicyId,
} satisfies Record<AppLocaleCode, ComponentType>;

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/security-policy">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Legal" });
  const path = `/${locale}/security-policy`;

  return {
    title: t("security-policy"),
    description: t("security-policy-description"),
    alternates: createLocalizedAlternates(path),
  };
}

export default function Page(props: PageProps<"/[locale]/security-policy">) {
  const { params } = props;
  const locale = getLocaleOrThrow(use(params).locale);

  return <PageContent locale={locale} />;
}

async function PageContent({ locale }: { locale: AppLocaleCode }) {
  "use cache";
  cacheLife("hours");

  const Content = contentByLocale[locale];

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Content />
    </main>
  );
}
