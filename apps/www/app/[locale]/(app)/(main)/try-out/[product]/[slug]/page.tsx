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
import { TryoutSetProvider } from "@/components/tryout/providers/set-state";
import { TryoutSetParts } from "@/components/tryout/set-parts";
import { TryoutSetShell } from "@/components/tryout/set-shell";
import { TryoutStartCta } from "@/components/tryout/start-cta";
import { TryoutStartDialog } from "@/components/tryout/start-dialog";
import { getToken, preloadAuthQuery } from "@/lib/auth/server";

interface Props {
  params: Promise<{ locale: Locale; product: string; slug: string }>;
}

/** Renders one tryout set page with an authenticated attempt preload when available. */
export default async function Page({ params }: Props) {
  const { locale, product: productParam, slug } = await params;
  const initialNowMs = Date.now();

  setRequestLocale(locale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [tCommon, tExercises, tTryouts, details, token] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Tryouts" }),
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

  const preloadedAttempt = token
    ? await preloadAuthQuery(
        api.tryouts.queries.me.attempt.getUserTryoutAttempt,
        {
          locale,
          product,
          tryoutSlug: slug,
        }
      )
    : undefined;

  const tryoutLabel = details.tryout.label;

  return (
    <TryoutSetProvider
      initialNowMs={initialNowMs}
      params={{
        locale,
        product,
        tryoutSlug: details.tryout.slug,
      }}
      preloadedAttempt={preloadedAttempt}
    >
      <TryoutSetShell>
        <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
          <div className="space-y-10">
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
                <TryoutStartCta />
                <TryoutStartDialog />
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
          </div>
        </div>
      </TryoutSetShell>
    </TryoutSetProvider>
  );
}
