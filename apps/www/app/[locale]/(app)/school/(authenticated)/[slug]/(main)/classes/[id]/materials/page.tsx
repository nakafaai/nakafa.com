import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesMaterialsHeader } from "@/components/school/classes/materials/header";
import { SchoolClassesMaterialsList } from "@/components/school/classes/materials/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <SchoolLayoutContent>
      <SchoolClassesMaterialsHeader />
      <SchoolClassesMaterialsList />
    </SchoolLayoutContent>
  );
}
