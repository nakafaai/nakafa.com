import {
  computeTryoutPartTimeLimitSeconds,
  isTryoutProduct,
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { getExercisesContent } from "@repo/contents/_lib/exercises";
import { Badge } from "@repo/design-system/components/ui/badge";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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

export const dynamicParams = false;

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

  const [tCommon, tExercises, tTryouts, staticTryout] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Tryouts" }),
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

  const tryoutLabel = staticTryout.label.replaceAll("-", " ");

  const getPartLabel = (currentPartKey: string) => {
    switch (currentPartKey) {
      case "mathematics":
        return tExercises("mathematics");
      case "quantitative-knowledge":
        return tExercises("quantitative-knowledge");
      case "mathematical-reasoning":
        return tExercises("mathematical-reasoning");
      case "general-reasoning":
        return tExercises("general-reasoning");
      case "indonesian-language":
        return tExercises("indonesian-language");
      case "english-language":
        return tExercises("english-language");
      case "general-knowledge":
        return tExercises("general-knowledge");
      case "reading-and-writing-skills":
        return tExercises("reading-and-writing-skills");
      default:
        return currentPartKey;
    }
  };

  const partLabel = getPartLabel(part.partKey);
  const timeLimitSeconds = computeTryoutPartTimeLimitSeconds({
    product,
    questionCount: part.questionCount,
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <header className="flex flex-col gap-3">
          <NavigationLink
            className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
            href={`/try-out/${product}/${slug}`}
          >
            {tCommon("back")}
          </NavigationLink>

          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{tTryouts("products.snbt.title")}</Badge>
            <Badge className="capitalize" variant="muted">
              {tryoutLabel}
            </Badge>
          </div>

          <h1 className="text-pretty font-medium text-4xl tracking-tight">
            {partLabel}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            {tTryouts("part-page-description", { part: partLabel })}
          </p>
        </header>

        <TryoutPartRuntime
          locale={locale}
          partKey={part.partKey}
          partLabel={partLabel}
          product={product}
          questionCount={part.questionCount}
          setSlug={part.setSlug}
          timeLimitSeconds={timeLimitSeconds}
          tryoutSlug={slug}
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
