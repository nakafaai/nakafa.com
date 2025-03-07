import { CardSubject } from "@/components/shared/card-subject";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderList } from "@/components/shared/header-list";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { LibraryIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { grade11Subjects } from "../data/subject";

const FILE_PATH = "app/[locale]/subject/senior-high-school/11";
const GITHUB_URL = `https://github.com/nabilfatih/nakafa.com/tree/main/${FILE_PATH}`;

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SeniorHighSchool11Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <HeaderList
        title={t("grade", { grade: 11 })}
        description={t("grade-description")}
        icon={LibraryIcon}
      />
      <LayoutContent className="py-10">
        <ContainerList>
          {grade11Subjects.map((subject) => (
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
