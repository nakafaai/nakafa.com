import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesList } from "@/components/school/classes/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

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

  return (
    <SchoolLayoutContent>
      <SchoolClassesList />
    </SchoolLayoutContent>
  );
}
