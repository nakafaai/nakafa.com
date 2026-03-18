import { api } from "@repo/backend/convex/_generated/api";
import {
  isTryoutProduct,
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { routing } from "@repo/internationalization/src/routing";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TryoutMeta } from "@/components/tryout/meta";
import { TryoutPageHead } from "@/components/tryout/page-head";
import { TryoutSetParts } from "@/components/tryout/set-parts";
import { TryoutStartButton } from "@/components/tryout/start-button";
import { getStaticTryouts } from "@/lib/utils/pages/tryouts";

interface Props {
  params: Promise<{ locale: Locale; product: string; slug: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const staticTryouts = await Promise.all(
    tryoutProducts.map((product) =>
      getStaticTryouts({ locale: routing.defaultLocale, product })
    )
  );

  return staticTryouts.flatMap((tryouts) =>
    tryouts.map((tryout) => ({
      product: tryout.product,
      slug: tryout.slug,
    }))
  );
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

  const getPartLabel = (partKey: string) => {
    switch (partKey) {
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
        return partKey;
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHead
            description={tTryouts("slug-description")}
            link={{ href: `/try-out/${product}`, label: tCommon("back") }}
            meta={
              <TryoutMeta
                cycleKey={details.tryout.cycleKey}
                product={product}
              />
            }
            title={tryoutLabel}
          />
          <div>
            <TryoutStartButton
              locale={locale}
              product={product}
              tryoutSlug={details.tryout.slug}
            />
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <TryoutSetParts
            locale={locale}
            parts={details.parts.map((part) => ({
              partIndex: part.partIndex,
              partKey: part.partKey,
              label: getPartLabel(part.partKey),
              material: part.material,
              questionCount: part.questionCount,
            }))}
            product={product}
            tryoutSlug={details.tryout.slug}
          />
        </section>
      </div>
    </div>
  );
}
