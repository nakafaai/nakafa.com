import { LayoutMaterial } from "@/components/shared/layout-material";
import type { ParsedHeading } from "@/components/shared/sidebar-tree";
import type { MaterialList } from "@/types/subjects";
import { PiIcon } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

const FILE_PATH = "/subject/senior-high-school/11/mathematics";
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
    title: t("grade", { grade: 11 }),
    description: t("grade-description"),
    alternates: {
      canonical: `/${locale}/subject/senior-high-school/11/mathematics`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Subject");

  // Enable static rendering
  setRequestLocale(locale);

  const materials: MaterialList[] = (await import(`./_data/${locale}-material`))
    .default;

  const chapters: ParsedHeading[] = materials.map((material) => ({
    label: material.title,
    href: `#${material.title.toLowerCase().replace(/\s+/g, "-")}`,
  }));

  return (
    <LayoutMaterial
      header={{
        title: t("mathematics"),
        icon: PiIcon,
        link: {
          href: "/subject/senior-high-school/11",
          label: t("grade", { grade: 11 }),
        },
      }}
      materials={materials}
      chapters={chapters}
      githubUrl={GITHUB_URL}
    />
  );
}
