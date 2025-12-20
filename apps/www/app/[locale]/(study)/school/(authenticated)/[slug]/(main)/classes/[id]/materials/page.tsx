import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesMaterialsHeader } from "@/components/school/classes/materials/header";
import { SchoolLayoutContent } from "@/components/school/layout-content";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <SchoolLayoutContent>
      <SchoolClassesMaterialsHeader />
    </SchoolLayoutContent>
  );
}
