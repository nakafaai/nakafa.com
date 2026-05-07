import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/events">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "About" });
  const path = `/${locale}/events`;

  return {
    title: t("events"),
    description: t("events-description"),
    alternates: createLocalizedAlternates(path),
  };
}

export default function Page() {
  return null;
}
