import { isTryoutProduct } from "@repo/backend/convex/tryouts/products";
import { notFound } from "next/navigation";
import { TryoutPartBody } from "@/app/[locale]/(app)/(shared)/try-out/[product]/[slug]/part/[partKey]/body";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Renders one tryout part page after the session layout has mounted the shell. */
export default async function Page(
  props: PageProps<"/[locale]/try-out/[product]/[slug]/part/[partKey]">
) {
  const { params, searchParams } = props;
  const { locale: rawLocale, partKey, product, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);

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
