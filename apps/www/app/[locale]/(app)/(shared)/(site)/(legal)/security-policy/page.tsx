import { captureServerException } from "@repo/analytics/posthog/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

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

async function PageContent({ locale }: { locale: Locale }) {
  try {
    const { default: Content } = await import(
      `@/app/[locale]/(app)/(shared)/(site)/(legal)/security-policy/${locale}.mdx`
    );

    if (!Content) {
      notFound();
    }

    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Content />
      </main>
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      locale,
      source: "security-policy-content",
    });

    notFound();
  }
}
