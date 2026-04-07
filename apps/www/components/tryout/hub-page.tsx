import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { TryoutCatalogCard } from "@/components/tryout/catalog-card";
import { TryoutCatalogList } from "@/components/tryout/catalog-list";
import { TryoutHubHeader } from "@/components/tryout/hub-header";
import { SnbtTryoutIcon } from "@/components/tryout/product-icon";
import { TRYOUT_CATALOG_PAGE_SIZE } from "@/components/tryout/utils/catalog";
import { getToken } from "@/lib/auth/server";

/** Renders the server-backed tryout hub with an SSR first catalog page. */
export async function TryoutHubPage({ locale }: { locale: Locale }) {
  const product: TryoutProduct = "snbt";
  const initialNowMs = Date.now();
  const { tHome, tTryouts, catalogSnapshot, currentUser } =
    await Effect.runPromise(
      Effect.gen(function* () {
        const { tHome, tTryouts, token } = yield* Effect.all(
          {
            tHome: Effect.tryPromise({
              try: () => getTranslations({ locale, namespace: "Home" }),
              catch: () => new Error("Failed to load home translations"),
            }),
            tTryouts: Effect.tryPromise({
              try: () => getTranslations({ locale, namespace: "Tryouts" }),
              catch: () => new Error("Failed to load tryout translations"),
            }),
            token: Effect.tryPromise({
              try: () => getToken(),
              catch: () => new Error("Failed to load user token"),
            }),
          },
          { concurrency: "unbounded" }
        );

        const { catalogSnapshot, currentUser } = yield* Effect.all(
          {
            catalogSnapshot: Effect.tryPromise({
              try: () =>
                fetchQuery(
                  api.tryouts.queries.tryouts.getActiveTryoutCatalogSnapshot,
                  {
                    locale,
                    pageSize: TRYOUT_CATALOG_PAGE_SIZE,
                    product,
                  },
                  token ? { token } : undefined
                ),
              catch: () =>
                new Error("Failed to load active tryout catalog snapshot"),
            }),
            currentUser: token
              ? Effect.tryPromise({
                  try: () => fetchQuery(api.auth.getCurrentUser, {}, { token }),
                  catch: () => new Error("Failed to load current user"),
                })
              : Effect.succeed(null),
          },
          { concurrency: "unbounded" }
        );

        return { tHome, tTryouts, token, catalogSnapshot, currentUser };
      })
    );
  const userName = currentUser?.appUser.name ?? tHome("guest");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutHubHeader
          description={tTryouts("description")}
          greeting={tHome("greeting", { name: userName })}
          title={tTryouts("title")}
        />

        <TryoutCatalogCard
          action={
            <Button
              nativeButton={false}
              render={
                <NavigationLink href={`/try-out/${product}`}>
                  {tTryouts("cta")}
                  <HugeIcons className="size-4" icon={ArrowRight02Icon} />
                </NavigationLink>
              }
            />
          }
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
  );
}
