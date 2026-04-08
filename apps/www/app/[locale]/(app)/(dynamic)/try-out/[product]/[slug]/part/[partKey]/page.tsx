import { api } from "@repo/backend/convex/_generated/api";
import {
  isTryoutProduct,
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/convex/tryouts/products";
import { getExercisesContent } from "@repo/contents/_lib/exercises";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { slugify } from "@repo/design-system/lib/utils";
import { routing } from "@repo/internationalization/src/routing";
import { fetchQuery, preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { Effect } from "effect";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { QuestionAnalytics } from "@/app/[locale]/(app)/(static)/(learn)/exercises/[category]/[type]/[material]/[...slug]/analytics";
import { ExerciseArticle } from "@/app/[locale]/(app)/(static)/(learn)/exercises/[category]/[type]/[material]/[...slug]/article";
import {
  getTryoutHistoryHref,
  loadTryoutSearchParams,
} from "@/components/tryout/nuqs/attempt";
import { TryoutPartRuntime } from "@/components/tryout/part-runtime";
import { TryoutPartShellBoundary } from "@/components/tryout/part-shell-boundary";
import { TryoutPartProvider } from "@/components/tryout/providers/part-state";
import { getToken } from "@/lib/auth/server";

type Props = PageProps<"/[locale]/try-out/[product]/[slug]/part/[partKey]"> & {
  searchParams: Promise<SearchParams>;
};

/** Renders one tryout part page with a native Convex preload when authenticated. */
export default async function Page({ params, searchParams }: Props) {
  const { locale, product: productParam, slug, partKey } = await params;
  const initialNowMs = Date.now();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [tExercises, details, token] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    fetchQuery(api.tryouts.queries.tryouts.getTryoutDetails, {
      locale,
      product,
      slug,
    }),
    getToken(),
  ]);

  if (!details) {
    notFound();
  }

  const { attempt } = await loadTryoutSearchParams(searchParams);
  const preloadedRuntime = token
    ? await preloadQuery(
        api.tryouts.queries.me.part.getUserTryoutPartAttempt,
        {
          attemptId: attempt ?? undefined,
          locale,
          partKey,
          product,
          tryoutSlug: slug,
        },
        { token }
      )
    : undefined;
  const runtime = preloadedRuntime
    ? preloadedQueryResult(preloadedRuntime)
    : undefined;

  if (token && runtime && !runtime.part) {
    redirect(getTryoutHistoryHref(`/try-out/${product}/${slug}`, attempt));
  }

  const currentPart = details.parts.find((item) => item.partKey === partKey);
  const contentPart = (() => {
    if (runtime?.part) {
      return {
        material: runtime.part.material,
        partKey: runtime.part.currentPartKey,
        questionCount: runtime.part.questionCount,
        setSlug: runtime.part.setSlug,
      };
    }

    if (currentPart) {
      return {
        material: currentPart.material,
        partKey: currentPart.partKey,
        questionCount: currentPart.questionCount,
        setSlug: currentPart.setSlug,
      };
    }

    return null;
  })();

  if (!contentPart) {
    notFound();
  }

  const exercises = await Effect.runPromise(
    Effect.match(
      getExercisesContent({ locale, filePath: contentPart.setSlug }),
      {
        onFailure: () => [],
        onSuccess: (data) => data,
      }
    )
  );

  if (exercises.length === 0) {
    notFound();
  }

  const tryoutLabel = details.tryout.label;
  const partKeys = details.parts.map((part) => part.partKey);

  const materialLabel = ExercisesMaterialSchema.safeParse(contentPart.material);
  const partLabel = materialLabel.success
    ? tExercises(materialLabel.data)
    : contentPart.partKey;
  const timeLimitSeconds = tryoutProductPolicies[
    product
  ].getPartTimeLimitSeconds(contentPart.questionCount);
  const material = ExercisesMaterialSchema.safeParse(contentPart.material);
  const partIcon = material.success
    ? getMaterialIcon(material.data)
    : undefined;

  return (
    <TryoutPartProvider
      initialNowMs={initialNowMs}
      part={{
        key: contentPart.partKey,
        label: partLabel,
        questionCount: contentPart.questionCount,
        setSlug: contentPart.setSlug,
        timeLimitSeconds,
      }}
      partKeys={partKeys}
      preloadedRuntime={preloadedRuntime}
      tryout={{
        cycleKey: details.tryout.cycleKey,
        label: tryoutLabel,
        locale,
        product,
        slug,
      }}
    >
      <TryoutPartShellBoundary>
        <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
          <div className="space-y-10">
            <TryoutPartRuntime icon={partIcon}>
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
      </TryoutPartShellBoundary>
    </TryoutPartProvider>
  );
}
