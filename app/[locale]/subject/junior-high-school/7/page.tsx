import { HeaderList } from "@/components/shared/header-list";
import { LibraryIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function JuniorHighSchool7Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <HeaderList
        title={t("grade", { grade: 7 })}
        description={t("grade-description")}
        icon={LibraryIcon}
      />
    </>
  );
}
