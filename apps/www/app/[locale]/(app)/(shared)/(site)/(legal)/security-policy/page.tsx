import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { ComponentType } from "react";
import { use } from "react";
import { getActiveLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import SecurityPolicyEn from "./en.mdx";
import SecurityPolicyId from "./id.mdx";

const contentByLocale = {
  en: SecurityPolicyEn,
  id: SecurityPolicyId,
} satisfies Record<ActiveAppLocaleCode, ComponentType>;

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/security-policy">["params"];
}): Promise<Metadata> {
  const locale = getActiveLocaleOrThrow((await params).locale);
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
