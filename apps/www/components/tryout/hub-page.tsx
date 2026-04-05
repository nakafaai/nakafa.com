import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
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
import { TryoutCatalogList } from "@/components/tryout/catalog-list";
import { TryoutHubHeader } from "@/components/tryout/hub-header";
import { SnbtTryoutIcon } from "@/components/tryout/product-icon";
import { TRYOUT_CATALOG_PAGE_SIZE } from "@/components/tryout/utils/catalog";
import { getToken } from "@/lib/auth/server";

/** Renders the server-backed tryout hub with an SSR first catalog page. */
export async function TryoutHubPage({ locale }: { locale: Locale }) {
  const product: TryoutProduct = "snbt";
  const initialNowMs = Date.now();
  const [tTryouts, token] = await Promise.all([
    getTranslations({ locale, namespace: "Tryouts" }),
    getToken(),
  ]);
  const catalogSnapshot = await fetchQuery(
    api.tryouts.queries.tryouts.getActiveTryoutCatalogSnapshot,
    {
      locale,
      pageSize: TRYOUT_CATALOG_PAGE_SIZE,
      product,
    },
    token ? { token } : undefined
  );

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
                  <Badge variant="outline">
                    {tTryouts("package-count", {
                      count: catalogSnapshot.activeCount,
                    })}
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
            <TryoutCatalogList
              initialEntries={catalogSnapshot.initialPage}
              initialNowMs={initialNowMs}
              locale={locale}
              product={product}
            />
          </TryoutCardContent>
        </TryoutCard>
      </div>
    </div>
  );
}
