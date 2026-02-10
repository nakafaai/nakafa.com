import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesPeopleHeader } from "@/components/school/classes/people/header";
import { SchoolClassesPeopleList } from "@/components/school/classes/people/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <SchoolLayoutContent>
      <SchoolClassesPeopleHeader />
      <SchoolClassesPeopleList />
    </SchoolLayoutContent>
  );
}
