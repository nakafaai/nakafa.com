import { isTryoutProduct } from "@repo/backend/convex/tryouts/products";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { TryoutSessionShell } from "@/components/tryout/session-shell";

/** Renders the shared locked shell for one tryout set and its nested part routes. */
export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string; product: string; slug: string }>;
}) {
  const { children, params } = props;
  const { locale, product, slug } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  if (!isTryoutProduct(product)) {
    notFound();
  }

  return (
    <TryoutSessionShell locale={locale} product={product} slug={slug}>
      {children}
    </TryoutSessionShell>
  );
}
