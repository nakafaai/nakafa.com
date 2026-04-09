import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
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

export default function Page(
  props: PageProps<"/[locale]/school/[slug]/notifications">
) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  return <SchoolLayoutContent />;
}
