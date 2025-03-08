import { HeaderContent } from "@/components/shared/header-content";
import { BackpackIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ElementarySchool3Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <>
      <HeaderContent
        title={t("grade", { grade: 3 })}
        description={t("grade-description")}
        icon={BackpackIcon}
      />
    </>
  );
}
