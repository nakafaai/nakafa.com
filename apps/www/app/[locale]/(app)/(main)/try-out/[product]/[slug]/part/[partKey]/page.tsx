import {
  isTryoutProduct,
  type TryoutProduct,
  tryoutProductPolicies,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { getExercisesContent } from "@repo/contents/_lib/exercises";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { slugify } from "@repo/design-system/lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuestionAnalytics } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/analytics";
import { ExerciseArticle } from "@/app/[locale]/(app)/(main)/(contents)/exercises/[category]/[type]/[material]/[...slug]/article";
import { TryoutPartRuntime } from "@/components/tryout/part-runtime";
import { getStaticTryout, getStaticTryouts } from "@/lib/utils/pages/tryouts";

interface Props {
  params: Promise<{
    locale: Locale;
    partKey: string;
    product: string;
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const staticTryouts = await Promise.all(
    tryoutProducts.map((product) =>
      getStaticTryouts({ locale: routing.defaultLocale, product })
    )
  );

  return staticTryouts.flatMap((tryouts) =>
    tryouts.flatMap((tryout) =>
      tryout.parts.map((part) => ({
        product: tryout.product,
        slug: tryout.slug,
        partKey: part.partKey,
      }))
    )
  );
}

export default async function Page({ params }: Props) {
  const { locale, product: productParam, slug, partKey } = await params;

  setRequestLocale(locale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [tExercises, staticTryout] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getStaticTryout({ locale, product, slug }),
  ]);

  if (!staticTryout) {
    notFound();
  }

  const part = staticTryout.parts.find((item) => item.partKey === partKey);

  if (!part) {
    notFound();
  }

  const exercises = await Effect.runPromise(
    Effect.match(getExercisesContent({ locale, filePath: part.setSlug }), {
      onFailure: () => [],
      onSuccess: (data) => data,
    })
  );

  if (exercises.length === 0) {
    notFound();
  }

  const tryoutLabel = staticTryout.label;

  const materialLabel = ExercisesMaterialSchema.safeParse(part.partKey);
  const partLabel = materialLabel.success
    ? tExercises(materialLabel.data)
    : part.partKey;
  const timeLimitSeconds = tryoutProductPolicies[
    product
  ].getPartTimeLimitSeconds(part.questionCount);
  const material = ExercisesMaterialSchema.safeParse(part.partKey);
  const partIcon = material.success
    ? getMaterialIcon(material.data)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPartRuntime
          icon={partIcon}
          part={{
            key: part.partKey,
            label: partLabel,
            questionCount: part.questionCount,
            setSlug: part.setSlug,
            timeLimitSeconds,
          }}
          tryout={{
            cycleKey: staticTryout.cycleKey,
            label: tryoutLabel,
            locale,
            product,
            slug,
          }}
        >
          {exercises.map((exercise) => {
            const id = slugify(
              tExercises("number-count", { count: exercise.number })
            );

            return (
              <QuestionAnalytics
                exerciseNumber={exercise.number}
                key={exercise.number}
              >
                <ExerciseArticle
                  exercise={exercise}
                  id={id}
                  locale={locale}
                  srLabel={tExercises("number-count", {
                    count: exercise.number,
                  })}
                />
              </QuestionAnalytics>
            );
          })}
        </TryoutPartRuntime>
      </div>
    </div>
  );
}
