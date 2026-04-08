import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesMaterialsHeader } from "@/components/school/classes/materials/header";
import { SchoolClassesMaterialsList } from "@/components/school/classes/materials/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(
  props: PageProps<"/[locale]/school/[slug]/classes/[id]/materials">
) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  return (
    <SchoolLayoutContent>
      <SchoolClassesMaterialsHeader />
      <SchoolClassesMaterialsList />
    </SchoolLayoutContent>
  );
}
