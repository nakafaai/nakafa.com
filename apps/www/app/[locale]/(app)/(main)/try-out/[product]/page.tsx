import { Certificate02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import {
  isTryoutProduct,
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  TryoutCard,
  TryoutCardArt,
  TryoutCardBody,
  TryoutCardContent,
  TryoutCardCopy,
  TryoutCardDescription,
  TryoutCardHero,
  TryoutCardTitle,
} from "@/components/tryout/card";
import {
  TryoutPackageCopy,
  TryoutPackageEmpty,
  TryoutPackageHeader,
  TryoutPackageItems,
  TryoutPackageLink,
  TryoutPackageMeta,
  TryoutPackageTitle,
  TryoutPackageYear,
} from "@/components/tryout/package-list";
import { TryoutPackageInProgressBadge } from "@/components/tryout/package-progress";
import { SnbtTryoutIcon } from "@/components/tryout/product-icon";
import { TryoutPackageProgressProvider } from "@/components/tryout/providers/package-progress";
import { groupActiveTryoutsByCycle } from "@/components/tryout/utils/package-list";

interface Props {
  params: Promise<{ locale: Locale; product: string }>;
}

export function generateStaticParams() {
  return tryoutProducts.map((product) => ({ product }));
}

export default async function Page({ params }: Props) {
  const { locale, product: productParam } = await params;

  setRequestLocale(locale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [tCommon, tTryouts, activeTryouts] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
    fetchQuery(api.tryouts.queries.tryouts.getActiveTryouts, {
      locale,
      product,
    }),
  ]);

  const cycleGroups = groupActiveTryoutsByCycle(activeTryouts);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <header className="flex flex-col gap-3">
          <NavigationLink
            aria-label={tCommon("back")}
            className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
            href="/try-out"
            title={tCommon("back")}
          >
            {tCommon("back")}
          </NavigationLink>

          <div className="flex items-start gap-2">
            <HugeIcons
              className="hidden size-7 shrink-0 translate-y-1 sm:block"
              icon={Certificate02Icon}
            />
            <h1 className="text-pretty font-medium text-3xl tracking-tight">
              {tTryouts("products.snbt.title")}
            </h1>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            {tTryouts("product-page-description")}
          </p>
        </header>

        <TryoutCard>
          <TryoutCardHero>
            <TryoutCardArt>
              <SnbtTryoutIcon />
            </TryoutCardArt>

            <TryoutCardBody className="gap-0">
              <TryoutCardCopy>
                <div className="flex flex-wrap items-center gap-2">
                  <TryoutCardTitle>
                    {tTryouts("products.snbt.title")}
                  </TryoutCardTitle>
                  <Badge variant="secondary">
                    {tTryouts("package-count", { count: activeTryouts.length })}
                  </Badge>
                </div>

                <TryoutCardDescription>
                  {tTryouts("products.snbt.description")}
                </TryoutCardDescription>
              </TryoutCardCopy>
            </TryoutCardBody>
          </TryoutCardHero>

          <TryoutCardContent>
            {cycleGroups.length === 0 ? (
              <TryoutPackageEmpty>{tTryouts("list-empty")}</TryoutPackageEmpty>
            ) : (
              <TryoutPackageProgressProvider locale={locale} product={product}>
                {cycleGroups.map((group, index) => (
                  <div
                    className={cn(index > 0 && "border-t")}
                    key={group.cycleKey}
                  >
                    <TryoutPackageYear>
                      {tTryouts("year-title", { year: group.cycleKey })}
                    </TryoutPackageYear>

                    <TryoutPackageItems>
                      {group.tryouts.map((tryout) => (
                        <TryoutPackageLink
                          href={`/try-out/${product}/${tryout.slug}`}
                          key={tryout._id}
                        >
                          <TryoutPackageCopy>
                            <TryoutPackageHeader>
                              <TryoutPackageTitle>
                                {tryout.label}
                              </TryoutPackageTitle>
                              <TryoutPackageInProgressBadge
                                tryoutSlug={tryout.slug}
                              />
                            </TryoutPackageHeader>
                            <TryoutPackageMeta>
                              {tTryouts("available-item-description", {
                                parts: tryout.partCount,
                                questions: tryout.totalQuestionCount,
                              })}
                            </TryoutPackageMeta>
                          </TryoutPackageCopy>
                        </TryoutPackageLink>
                      ))}
                    </TryoutPackageItems>
                  </div>
                ))}
              </TryoutPackageProgressProvider>
            )}
          </TryoutCardContent>
        </TryoutCard>
      </div>
    </div>
  );
}
