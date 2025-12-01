import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "School.Common" });

  return {
    title: t("classes"),
  };
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return <div className="size-full overflow-y-auto overflow-x-hidden" />;
}
