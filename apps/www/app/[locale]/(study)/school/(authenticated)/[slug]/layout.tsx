import { api } from "@repo/backend/convex/_generated/api";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { routing } from "@repo/internationalization/src/routing";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { SchoolNotFound } from "@/components/school/not-found";
import { SchoolContextProvider } from "@/lib/context/use-school";

export async function generateMetadata({
  params,
}: {
  params: LayoutProps<"/[locale]/school/[slug]">["params"];
}): Promise<Metadata> {
  const { slug } = await params;
  const defaultMetadata = {};

  try {
    const schoolInfo = await fetchQuery(
      api.schools.queries.getSchoolInfoBySlug,
      {
        slug,
      }
    );
    if (!schoolInfo) {
      return defaultMetadata;
    }
    return {
      title: {
        absolute: schoolInfo.name,
      },
    };
  } catch {
    return defaultMetadata;
  }
}

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
    <ErrorBoundary fallback={<SchoolNotFound />}>
      <SchoolContextProvider slug={decodeURIComponent(slug)}>
        {children}
      </SchoolContextProvider>
    </ErrorBoundary>
  );
}
