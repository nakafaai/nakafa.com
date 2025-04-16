import { CardSubject } from "@/components/shared/card-subject";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getGradePath, getGradeSubjects } from "@/lib/utils/subject/grade";
import { getStaticParams } from "@/lib/utils/system";
import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import { LibraryIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Params = {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category, grade } = await params;
  const t = await getTranslations("Subject");

  const FILE_PATH = getGradePath(category, grade);

  const image = {
    url: ["/og", FILE_PATH, "image.png"].join("/"),
    width: 1200,
    height: 630,
  };

  return {
    title: t("grade", { grade }),
    description: t("grade-description"),
    alternates: {
      canonical: `/${locale}${FILE_PATH}`,
    },
    openGraph: {
      url: `/${locale}${FILE_PATH}`,
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "contents/subject",
    paramNames: ["category", "grade"],
  });
}

export default async function Page({ params }: Props) {
  const { locale, category, grade } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  const FILE_PATH = getGradePath(category, grade);

  const subjects = await getGradeSubjects(category, grade);

  return (
    <>
      <HeaderContent
        title={t("grade", { grade })}
        description={t("grade-description")}
        icon={LibraryIcon}
      />
      <LayoutContent className="py-10">
        <ContainerList>
          {subjects.map((subject) => (
            <CardSubject
              key={subject.label}
              {...subject}
              label={t(subject.label)}
            />
          ))}
        </ContainerList>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent githubUrl={getGithubUrl(`/contents${FILE_PATH}`)} />
      </FooterContent>
    </>
  );
}
