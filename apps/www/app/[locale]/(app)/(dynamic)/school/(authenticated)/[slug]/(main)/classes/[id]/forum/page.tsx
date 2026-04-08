import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolClassesForumHeader } from "@/components/school/classes/forum/header";
import { SchoolClassesForumList } from "@/components/school/classes/forum/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(
  props: PageProps<"/[locale]/school/[slug]/classes/[id]/forum">
) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  return (
    <SchoolLayoutContent>
      <SchoolClassesForumHeader />
      <SchoolClassesForumList />
    </SchoolLayoutContent>
  );
}
