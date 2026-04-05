import { api } from "@repo/backend/convex/_generated/api";
import {
  isTryoutProduct,
  type TryoutProduct,
} from "@repo/backend/convex/tryouts/products";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TryoutPageHeader } from "@/components/tryout/page-header";
import { TryoutPageMeta } from "@/components/tryout/page-meta";
import { TryoutAttemptStateProvider } from "@/components/tryout/providers/attempt-state";
import { TryoutSetParts } from "@/components/tryout/set-parts";
import { TryoutStartButton } from "@/components/tryout/start-button";

interface Props {
  params: Promise<{ locale: Locale; product: string; slug: string }>;
}

export default async function Page({ params }: Props) {
  const { locale, product: productParam, slug } = await params;

  setRequestLocale(locale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [tCommon, tExercises, tTryouts, details] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Tryouts" }),
    fetchQuery(api.tryouts.queries.tryouts.getTryoutDetails, {
      locale,
      product,
      slug,
    }),
  ]);

  if (!details) {
    notFound();
  }

  const tryoutLabel = details.tryout.label;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutAttemptStateProvider
          locale={locale}
          product={product}
          tryoutSlug={details.tryout.slug}
        >
          <div className="space-y-6">
            <TryoutPageHeader
              description={tTryouts("slug-description")}
              link={{ href: `/try-out/${product}`, label: tCommon("back") }}
              meta={
                <TryoutPageMeta
                  cycleKey={details.tryout.cycleKey}
                  product={product}
                />
              }
              title={tryoutLabel}
            />
            <div>
              <TryoutStartButton />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
            <TryoutSetParts
              parts={details.parts.map((part) => {
                const materialLabel = ExercisesMaterialSchema.safeParse(
                  part.material
                );

                return {
                  partIndex: part.partIndex,
                  partKey: part.partKey,
                  label: materialLabel.success
                    ? tExercises(materialLabel.data)
                    : part.partKey,
                  material: part.material,
                  questionCount: part.questionCount,
                };
              })}
            />
          </section>
        </TryoutAttemptStateProvider>
      </div>
    </div>
  );
}
