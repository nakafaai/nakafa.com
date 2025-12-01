import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolContextProvider } from "@/lib/context/use-school";

export default function Layout(props: LayoutProps<"/[locale]/school/[slug]">) {
  const { children, params } = props;
  const { locale, slug } = use(params);
  if (!hasLocale(routing.locales, locale)) {
    // Ensure that the incoming `locale` is valid
    notFound();
  }

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <ErrorBoundary fallback={null}>
      <SchoolContextProvider slug={decodeURIComponent(slug)}>
        {children}
      </SchoolContextProvider>
    </ErrorBoundary>
  );
}
