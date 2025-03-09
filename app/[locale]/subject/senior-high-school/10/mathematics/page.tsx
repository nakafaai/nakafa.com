import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { PiIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

const FILE_PATH = "/subject/senior-high-school/10/mathematics";
const GITHUB_URL = `${process.env.GITHUB_URL}${FILE_PATH}`;

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  return {
    title: t("grade", { grade: 10 }),
    description: t("grade-description"),
    alternates: {
      canonical: `/${locale}/subject/senior-high-school/10/mathematics`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <HeaderContent
        title={t("mathematics")}
        icon={PiIcon}
        link={{
          href: "/subject/senior-high-school/10",
          label: t("grade", { grade: 10 }),
        }}
      />
      <LayoutContent className="py-10">
        <ContainerList>
          <div />
        </ContainerList>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent githubUrl={GITHUB_URL} />
      </FooterContent>
    </>
  );
}
