import { HeaderContent } from "@/components/shared/header-content";
import { NotebookIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
    title: t("grade", { grade: 7 }),
    description: t("grade-description"),
    alternates: {
      canonical: `/${locale}/subject/junior-high-school/7`,
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
        title={t("grade", { grade: 7 })}
        description={t("grade-description")}
        icon={NotebookIcon}
      />
    </>
  );
}
