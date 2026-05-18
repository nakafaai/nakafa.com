import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/contributor/avatar";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { contributors } from "@/lib/data/contributor";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/contributor">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Contributor" });
  const path = `/${locale}/contributor`;

  return {
    title: t("title"),
    description: t("description"),
    alternates: createLocalizedAlternates(path),
  };
}

export default function Page() {
  return (
    <>
      <PageHeader />
      <LayoutContent>
        <div className="flex flex-wrap gap-2">
          {contributors.map((contributor) => (
            <Avatar contributor={contributor} key={contributor.username} />
          ))}
        </div>
      </LayoutContent>
    </>
  );
}

function PageHeader() {
  const t = useTranslations("Contributor");

  return (
    <HeaderContent
      description={t("description")}
      icon={LoveKoreanFingerIcon}
      title={t("title")}
    />
  );
}
