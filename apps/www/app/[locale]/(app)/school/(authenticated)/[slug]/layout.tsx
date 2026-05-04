import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getToken } from "@/lib/auth/server";
import { SchoolContextProvider } from "@/lib/context/use-school";
import { getSchoolRouteSnapshot } from "@/lib/school/server";

/** Generate the school page title from the slug-resolved school metadata. */
export async function generateMetadata({
  params,
}: {
  params: LayoutProps<"/[locale]/school/[slug]">["params"];
}): Promise<Metadata> {
  const { slug } = await params;
  const defaultMetadata = {};
  const token = await getToken();

  if (!token) {
    return defaultMetadata;
  }

  const schoolRoute = await getSchoolRouteSnapshot(slug);

  if (!schoolRoute) {
    return defaultMetadata;
  }

  return {
    title: {
      absolute: schoolRoute.school.name,
    },
  };
}

/** Bind the resolved school route snapshot to the school subtree. */
export default function Layout(props: LayoutProps<"/[locale]/school/[slug]">) {
  const { children, params } = props;

  return (
    <Suspense fallback={null}>
      <ResolvedSchoolRouteBoundary params={params}>
        {children}
      </ResolvedSchoolRouteBoundary>
    </Suspense>
  );
}

/** Read the school slug from the route params inside a Suspense boundary. */
async function ResolvedSchoolRouteBoundary({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutProps<"/[locale]/school/[slug]">["params"];
}) {
  const { slug } = await params;

  return <SchoolRouteBoundary slug={slug}>{children}</SchoolRouteBoundary>;
}

/**
 * Resolve the authenticated school route snapshot on the server before mounting
 * the school client subtree.
 */
async function SchoolRouteBoundary({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const token = await getToken();

  if (!token) {
    return children;
  }

  const value = await getSchoolRouteSnapshot(slug);

  if (!value) {
    notFound();
  }

  return (
    <SchoolContextProvider value={value}>{children}</SchoolContextProvider>
  );
}
