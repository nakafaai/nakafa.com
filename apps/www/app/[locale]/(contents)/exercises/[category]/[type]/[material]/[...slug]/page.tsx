import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Params = {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
  slug: string[];
};

type Props = {
  params: Promise<Params>;
};

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category", "type", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return null;
}
