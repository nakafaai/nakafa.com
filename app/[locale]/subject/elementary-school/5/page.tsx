import { HeaderList } from "@/components/shared/header-list";
import { BackpackIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ElementarySchool5Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <HeaderList
        title={t("grade", { grade: 5 })}
        description={t("grade-description")}
        icon={BackpackIcon}
      />
    </>
  );
}
