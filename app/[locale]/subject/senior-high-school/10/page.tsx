import { CardSubject } from "@/components/shared/card-subject";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { LibraryIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { grade10Subjects } from "../data/subject";

const FILE_PATH = "app/[locale]/subject/senior-high-school/10";
const GITHUB_URL = `https://github.com/nabilfatih/nakafa.com/tree/main/${FILE_PATH}`;

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
      canonical: `/${locale}/subject/senior-high-school/10`,
    },
  };
}

export default async function SeniorHighSchool10Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <HeaderContent
        title={t("grade", { grade: 10 })}
        description={t("grade-description")}
        icon={LibraryIcon}
      />
      <LayoutContent className="py-10">
        <ContainerList>
          {grade10Subjects.map((subject) => (
            <CardSubject
              key={subject.label}
              {...subject}
              label={t(subject.label)}
            />
          ))}
        </ContainerList>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent githubUrl={GITHUB_URL} />
      </FooterContent>
    </>
  );
}
