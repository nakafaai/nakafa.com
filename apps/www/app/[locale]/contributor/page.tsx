import { Avatar } from "@repo/design-system/components/contributor/avatar";
import { HeartHandshakeIcon } from "lucide-react";
import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { contributors } from "@/lib/data/contributor";
import { getGithubUrl } from "@/lib/utils/github";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Contributor");

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/contributor`,
    },
  };
}

export default function Page() {
  const t = useTranslations("Contributor");

  return (
    <>
      <HeaderContent
        description={t("description")}
        icon={HeartHandshakeIcon}
        title={t("title")}
      />
      <LayoutContent>
        <div className="flex flex-wrap gap-2">
          {contributors.map((contributor) => (
            <Avatar contributor={contributor} key={contributor.username} />
          ))}
        </div>
      </LayoutContent>
      <FooterContent>
        <RefContent
          githubUrl={getGithubUrl({
            path: encodeURI("/app/[locale]/contributor"),
          })}
        />
      </FooterContent>
    </>
  );
}
