import { api } from "@repo/backend/convex/_generated/api";
import {
  type TryoutProduct,
  tryoutProductPolicies,
} from "@repo/backend/convex/tryouts/products";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { preloadedQueryResult, preloadQuery } from "convex/nextjs";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ExerciseTrackedEntry } from "@/components/exercise/entry";
import { TryoutPartRouteShell } from "@/components/tryout/part-route-shell";
import { TryoutPartRuntime } from "@/components/tryout/part-runtime";
import { TryoutPartProvider } from "@/components/tryout/providers/part-provider";
import { loadTryoutSearchParams } from "@/components/tryout/utils/attempt-search";
import {
  getTryoutHistoryHref,
  getTryoutSetHref,
} from "@/components/tryout/utils/routes";
import { getToken } from "@/lib/auth/server";
import { getTryoutExercises, getTryoutPartData } from "./data";

/** Preloads the authenticated tryout runtime when the current request has a token. */
async function getTryoutRuntime(
  token: Awaited<ReturnType<typeof getToken>>,
  args: {
    attempt: string | null;
    locale: Locale;
    partKey: string;
    product: TryoutProduct;
    slug: string;
  }
) {
  if (!token) {
    return {
      preloadedRuntime: undefined,
      runtime: undefined,
    };
  }

  const preloadedRuntime = await preloadQuery(
    api.tryouts.queries.me.part.getUserTryoutPartAttempt,
    {
      attemptId: args.attempt ?? undefined,
      locale: args.locale,
      partKey: args.partKey,
      product: args.product,
      tryoutSlug: args.slug,
    },
    { token }
  );

  return {
    preloadedRuntime,
    runtime: preloadedQueryResult(preloadedRuntime),
  };
}

/** Resolves the full tryout part route after the local Suspense boundary opens. */
export async function TryoutPartBody({
  locale,
  partKey,
  product,
  searchParams,
  slug,
}: {
  locale: Locale;
  partKey: string;
  product: TryoutProduct;
  searchParams: PageProps<"/[locale]/try-out/[product]/[slug]/part/[partKey]">["searchParams"];
  slug: string;
}) {
  const [partData, tExercises] = await Promise.all([
    getTryoutPartData(locale, product, slug, partKey),
    getTranslations({ locale, namespace: "Exercises" }),
  ]);

  if (!partData) {
    notFound();
  }

  const [token, { attempt }] = await Promise.all([
    getToken(),
    loadTryoutSearchParams(searchParams),
  ]);
  const initialNowMs = Date.now();
  const { preloadedRuntime, runtime } = await getTryoutRuntime(token, {
    attempt,
    locale,
    partKey,
    product,
    slug,
  });

  if (token && runtime && !runtime.part) {
    redirect(
      getTryoutHistoryHref(
        getTryoutSetHref({ product, tryoutSlug: slug }),
        attempt
      )
    );
  }

  const contentPart = runtime?.part
    ? {
        material: runtime.part.material,
        partKey: runtime.part.currentPartKey,
        questionCount: runtime.part.questionCount,
        setSlug: runtime.part.setSlug,
      }
    : {
        material: partData.currentPart.material,
        partKey: partData.currentPart.partKey,
        questionCount: partData.currentPart.questionCount,
        setSlug: partData.currentPart.setSlug,
      };

  const exercises = await getTryoutExercises(locale, contentPart.setSlug);

  if (exercises.length === 0) {
    notFound();
  }

  const material = ExercisesMaterialSchema.safeParse(contentPart.material);
  const partIcon = material.success
    ? getMaterialIcon(material.data)
    : undefined;
  const partLabel = material.success
    ? tExercises(material.data)
    : contentPart.partKey;
  const timeLimitSeconds = tryoutProductPolicies[
    product
  ].getPartTimeLimitSeconds(contentPart.questionCount);

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
      partKeys={partData.partKeys}
      preloadedRuntime={preloadedRuntime}
      tryout={{
        cycleKey: partData.details.tryout.cycleKey,
        label: partData.details.tryout.label,
        locale,
        product,
        slug,
      }}
    >
      <TryoutPartRouteShell>
        <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
          <div className="space-y-10">
            <TryoutPartRuntime icon={partIcon}>
              {exercises.map((exercise) => (
                <ExerciseTrackedEntry
                  exercise={exercise}
                  key={exercise.number}
                  locale={locale}
                  setPath={contentPart.setSlug}
                  srLabel={tExercises("number-count", {
                    count: exercise.number,
                  })}
                />
              ))}
            </TryoutPartRuntime>
          </div>
        </div>
      </TryoutPartRouteShell>
    </TryoutPartProvider>
  );
}
