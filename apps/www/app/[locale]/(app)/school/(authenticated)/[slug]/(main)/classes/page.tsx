import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SchoolClassesHeader } from "@/components/school/classes/header";
import { SchoolClassesList } from "@/components/school/classes/list";
import { SchoolLayoutContent } from "@/components/school/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/school/[slug]/classes">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "School.Common" });

  return {
    title: t("classes"),
  };
}

export default function Page() {
  return (
    <div className="relative">
      <SchoolClassesHeader />
      <SchoolLayoutContent>
        <SchoolClassesList />
      </SchoolLayoutContent>
    </div>
  );
}
