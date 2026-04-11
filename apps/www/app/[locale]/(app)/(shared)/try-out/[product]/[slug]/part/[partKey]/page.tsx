import { isTryoutProduct } from "@repo/backend/convex/tryouts/products";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { Suspense } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import { TryoutPartBody } from "./body";

/** Renders one tryout part page with a native Convex preload when authenticated. */
export default function Page(
  props: PageProps<"/[locale]/try-out/[product]/[slug]/part/[partKey]">
) {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="min-h-svh" />
        </AppShell>
      }
    >
      <ValidatedTryoutPartPage {...props} />
    </Suspense>
  );
}

/** Validates the route params before loading the streamed tryout part body. */
async function ValidatedTryoutPartPage(
  props: PageProps<"/[locale]/try-out/[product]/[slug]/part/[partKey]">
) {
  const { params, searchParams } = props;
  const { locale, partKey, product, slug } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (!isTryoutProduct(product)) {
    notFound();
  }

  return (
    <TryoutPartBody
      locale={locale}
      partKey={partKey}
      product={product}
      searchParams={searchParams}
      slug={slug}
    />
  );
}
