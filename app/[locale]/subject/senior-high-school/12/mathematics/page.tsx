import { CardMaterial } from "@/components/shared/card-material";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import type { MaterialList } from "@/types/subjects";
import { PiIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

const FILE_PATH = "/subject/senior-high-school/12/mathematics";
const GITHUB_URL = `${process.env.GITHUB_URL}${FILE_PATH}`;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  return {
    title: t("grade", { grade: 12 }),
    description: t("grade-description"),
    alternates: {
      canonical: `/${locale}/subject/senior-high-school/12/mathematics`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  const materials: MaterialList[] = (await import(`./data/${locale}-material`))
    .default;

  return (
    <>
      <HeaderContent
        title={t("mathematics")}
        icon={PiIcon}
        link={{
          href: "/subject/senior-high-school/12",
          label: t("grade", { grade: 12 }),
        }}
      />
      <LayoutContent className="py-10">
        <ContainerList className="sm:grid-cols-1">
          {materials.map((material) => (
            <CardMaterial key={material.title} material={material} />
          ))}
        </ContainerList>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent githubUrl={GITHUB_URL} />
      </FooterContent>
    </>
  );
}
