import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesPeopleHeader } from "@/components/school/classes/people/header";
import { SchoolClassesPeopleList } from "@/components/school/classes/people/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(
  props: PageProps<"/[locale]/school/[slug]/classes/[id]/people">
) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  return (
    <SchoolLayoutContent>
      <SchoolClassesPeopleHeader />
      <SchoolClassesPeopleList />
    </SchoolLayoutContent>
  );
}
