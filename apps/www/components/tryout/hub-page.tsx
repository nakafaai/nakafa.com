import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { fetchQuery } from "convex/nextjs";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
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
import { TryoutHubHeader } from "@/components/tryout/hub-header";
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

export async function TryoutHubPage({ locale }: { locale: Locale }) {
  const product: TryoutProduct = "snbt";
  const [tTryouts, activeTryouts] = await Promise.all([
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
        <TryoutHubHeader />

        <TryoutCard>
          <TryoutCardHero>
            <TryoutCardArt>
              <SnbtTryoutIcon />
            </TryoutCardArt>

            <TryoutCardBody>
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

              <div>
                <Button
                  nativeButton={false}
                  render={
                    <NavigationLink href={`/try-out/${product}`}>
                      {tTryouts("cta")}
                      <HugeIcons className="size-4" icon={ArrowRight02Icon} />
                    </NavigationLink>
                  }
                />
              </div>
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
