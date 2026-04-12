import { isTryoutProduct } from "@repo/backend/convex/tryouts/products";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { TryoutPartBody } from "./body";

/** Renders one tryout part page after the session layout has mounted the shell. */
export default async function Page(
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
