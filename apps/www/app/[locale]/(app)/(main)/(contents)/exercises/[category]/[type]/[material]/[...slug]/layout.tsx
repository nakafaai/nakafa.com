import { getSlugPath } from "@repo/contents/_lib/exercises/slug";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";
import { use } from "react";
import { ContentViewTracker } from "@/components/tracking/content-view-tracker";
import { AttemptContextProvider } from "@/lib/context/use-attempt";
import { ExerciseContextProvider } from "@/lib/context/use-exercise";
import { isNumber } from "@/lib/utils/number";

interface Params {
  category: ExercisesCategory;
  locale: Locale;
  material: ExercisesMaterial;
  slug: string[];
  type: ExercisesType;
}

interface Props {
  children: React.ReactNode;
  params: Promise<Params>;
}

export default function Layout({ children, params }: Props) {
  const { locale, category, type, material, slug } = use(params);

  const lastSlug = slug.at(-1);
  const baseSlug = lastSlug && isNumber(lastSlug) ? slug.slice(0, -1) : slug;

  const filePath = getSlugPath(category, type, material, baseSlug);

  const cleanedSlug = cleanSlug(filePath);

  return (
    <ContentViewTracker
      contentView={{ type: "exercise", slug: cleanedSlug }}
      locale={locale}
    >
      <ExerciseContextProvider slug={cleanedSlug}>
        <AttemptContextProvider slug={cleanedSlug}>
          {children}
        </AttemptContextProvider>
      </ExerciseContextProvider>
    </ContentViewTracker>
  );
}
