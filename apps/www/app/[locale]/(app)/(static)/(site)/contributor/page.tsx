import { LoveKoreanFingerIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@repo/design-system/components/contributor/avatar";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { contributors } from "@/lib/data/contributor";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/contributor">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Contributor" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/contributor`,
    },
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
