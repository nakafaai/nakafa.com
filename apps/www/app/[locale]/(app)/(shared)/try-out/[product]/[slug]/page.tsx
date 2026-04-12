import { api } from "@repo/backend/convex/_generated/api";
import {
  isTryoutProduct,
  type TryoutProduct,
} from "@repo/backend/convex/tryouts/products";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { fetchQuery, preloadQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TryoutSetProvider } from "@/components/tryout/providers/set-provider";
import { TryoutSetParts } from "@/components/tryout/set-parts";
import { TryoutPageHeader } from "@/components/tryout/shared/page-header";
import { TryoutPageMeta } from "@/components/tryout/shared/page-meta";
import { TryoutStartCta } from "@/components/tryout/start-cta";
import { TryoutStartDialog } from "@/components/tryout/start-dialog";
import { loadTryoutSearchParams } from "@/components/tryout/utils/attempt-search";
import { getTryoutProductHref } from "@/components/tryout/utils/routes";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders one tryout set page with a native Convex preload when authenticated. */
export default async function Page(
  props: PageProps<"/[locale]/try-out/[product]/[slug]">
) {
  const { params, searchParams } = props;
  const { locale: rawLocale, product: productParam, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [{ attempt }, tCommon, tExercises, tTryouts, details, token] =
    await Promise.all([
      loadTryoutSearchParams(searchParams),
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

  const initialNowMs = Date.now();
  const preloadedSetView = token
    ? await preloadQuery(
        api.tryouts.queries.me.setView.getUserTryoutSetView,
        {
          attemptId: attempt ?? undefined,
          locale,
          product,
          tryoutSlug: slug,
        },
        { token }
      )
    : undefined;

  const tryoutLabel = details.tryout.label;
  const partKeys = details.parts.map((part) => part.partKey);

  return (
    <TryoutSetProvider
      initialNowMs={initialNowMs}
      params={{
        locale,
        product,
        tryoutSlug: details.tryout.slug,
      }}
      partKeys={partKeys}
      preloadedSetView={preloadedSetView}
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
        <div className="space-y-10">
          <div className="space-y-6">
            <TryoutPageHeader
              description={tTryouts("slug-description")}
              link={{
                href: getTryoutProductHref(product),
                label: tCommon("back"),
              }}
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
    </TryoutSetProvider>
  );
}
