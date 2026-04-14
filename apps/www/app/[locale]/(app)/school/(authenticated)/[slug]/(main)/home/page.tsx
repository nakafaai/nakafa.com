import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SchoolLayoutContent } from "@/components/school/layout-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/school/[slug]/home">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "School.Common" });

  return {
    title: t("home"),
  };
}

/** Render the school home shell until live dashboard modules are connected. */
export default function Page() {
  return <SchoolLayoutContent />;
}
