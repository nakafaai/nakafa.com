import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SchoolContentState } from "@/components/school/content-state";
import { SchoolLayoutContent } from "@/components/school/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/school/[slug]/notifications">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "School.Common" });

  return {
    title: t("notifications"),
  };
}

/** Render the school notification shell until inbox data is connected. */
export default async function Page({
  params,
}: PageProps<"/[locale]/school/[slug]/notifications">) {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "School.Common" });

  return (
    <SchoolLayoutContent>
      <SchoolContentState
        description={t("notifications-empty-description")}
        title={t("notifications-empty-title")}
      />
    </SchoolLayoutContent>
  );
}
