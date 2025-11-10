import { Avatar } from "@repo/design-system/components/contributor/avatar";
import { HeartHandshakeIcon } from "lucide-react";
import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { Footer } from "@/components/about/footer";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { contributors } from "@/lib/data/contributor";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contributor" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/contributor`,
    },
  };
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

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
      <FooterContent childrenClassName="max-w-5xl">
        <Footer />
      </FooterContent>
    </>
  );
}

function PageHeader() {
  const t = useTranslations("Contributor");

  return (
    <HeaderContent
      description={t("description")}
      icon={HeartHandshakeIcon}
      title={t("title")}
    />
  );
}
