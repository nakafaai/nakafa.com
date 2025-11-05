import fs from "node:fs";
import path from "node:path";
import { getMaterialPath } from "@repo/contents/_lib/exercises/material";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Params = {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, type, material } = await params;
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const FilePath = getMaterialPath(category, type, material);

  let ogUrl: string = getOgUrl(locale, FilePath);

  const publicPath = `/open-graph/subject/${locale}-${material}.png` as const;
  const fullPathToCheck = path.join(process.cwd(), `public${publicPath}`);

  // if the og image exists in public directory, use it
  if (fs.existsSync(fullPathToCheck)) {
    ogUrl = publicPath;
  }

  const title = `${t(material)} - ${t(type)} - ${t(category)}`;
  const urlPath = `/${locale}${FilePath}`;
  const image = {
    url: ogUrl,
    width: 1200,
    height: 630,
  };

  return {
    title: {
      absolute: title,
    },
    alternates: {
      canonical: urlPath,
    },
    openGraph: {
      title,
      url: urlPath,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [image],
    },
    twitter: {
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category", "type", "material"],
  });
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return null;
}
