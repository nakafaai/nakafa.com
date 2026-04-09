import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/events">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "About" });

  return {
    title: t("events"),
    description: t("events-description"),
    alternates: {
      canonical: `/${locale}/events`,
    },
  };
}

export default function Page(props: PageProps<"/[locale]/events">) {
  const { params } = props;
  const locale = getLocaleOrThrow(use(params).locale);

  // Enable static rendering
  setRequestLocale(locale);

  return null;
}
