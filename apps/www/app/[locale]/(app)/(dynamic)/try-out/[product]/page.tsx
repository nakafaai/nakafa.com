import { Certificate02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import {
  isTryoutProduct,
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { routing } from "@repo/internationalization/src/routing";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppShell } from "@/components/sidebar/app-shell";
import { TryoutCatalogCard } from "@/components/tryout/catalog-card";
import { TryoutCatalogList } from "@/components/tryout/catalog-list";
import { SnbtTryoutIcon } from "@/components/tryout/product-icon";
import { TRYOUT_CATALOG_PAGE_SIZE } from "@/components/tryout/utils/catalog";
import { getTryoutHubHref } from "@/components/tryout/utils/routes";
import { getToken } from "@/lib/auth/server";

/** Enumerates the supported tryout product routes for static route discovery. */
export function generateStaticParams() {
  return tryoutProducts.map((product) => ({ product }));
}

/** Renders the server-backed tryout product landing page. */
export default async function Page(
  props: PageProps<"/[locale]/try-out/[product]">
) {
  const { params } = props;
  const { locale, product: productParam } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  if (!isTryoutProduct(productParam)) {
    notFound();
  }
  const product: TryoutProduct = productParam;

  const [tCommon, tTryouts, token] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Tryouts" }),
    getToken(),
  ]);

  const initialNowMs = Date.now();

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
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
        <div className="space-y-10">
          <header className="flex flex-col gap-3">
            <NavigationLink
              aria-label={tCommon("back")}
              className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
              href={getTryoutHubHref()}
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

          <TryoutCatalogCard
            activeCountLabel={tTryouts("package-count", {
              count: catalogSnapshot.activeCount,
            })}
            art={<SnbtTryoutIcon />}
            description={tTryouts("products.snbt.description")}
            title={tTryouts("products.snbt.title")}
          >
            <TryoutCatalogList
              initialEntries={catalogSnapshot.initialPage}
              initialNowMs={initialNowMs}
              locale={locale}
              product={product}
            />
          </TryoutCatalogCard>
        </div>
      </div>
    </AppShell>
  );
}
