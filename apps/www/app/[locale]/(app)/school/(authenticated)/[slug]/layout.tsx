import { captureServerException } from "@repo/analytics/posthog/server";
import { api } from "@repo/backend/convex/_generated/api";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { cache, use } from "react";
import { SchoolNotFound } from "@/components/school/not-found";
import { getToken } from "@/lib/auth/server";
import { SchoolContextProvider } from "@/lib/context/use-school";

const getSchoolInfo = cache(async (slug: string) =>
  fetchQuery(api.schools.queries.getSchoolInfoBySlug, { slug })
);

export async function generateMetadata({
  params,
}: {
  params: LayoutProps<"/[locale]/school/[slug]">["params"];
}): Promise<Metadata> {
  const { slug } = await params;
  const defaultMetadata = {};

  try {
    const schoolInfo = await getSchoolInfo(slug);
    if (!schoolInfo) {
      return defaultMetadata;
    }
    return {
      title: {
        absolute: schoolInfo.name,
      },
    };
  } catch (error) {
    await captureServerException(error, undefined, {
      slug,
      source: "school-layout-metadata",
    });

    return defaultMetadata;
  }
}

/** Bind the resolved school route snapshot to the school subtree. */
export default function Layout(props: LayoutProps<"/[locale]/school/[slug]">) {
  const { children, params } = props;
  const { slug } = use(params);

  return (
    <SchoolRouteBoundary slug={decodeURIComponent(slug)}>
      {children}
    </SchoolRouteBoundary>
  );
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
    return <SchoolNotFound />;
  }

  try {
    const value = await fetchQuery(
      api.schools.queries.getSchoolBySlug,
      { slug },
      { token }
    );

    return (
      <ErrorBoundary fallback={<SchoolNotFound />}>
        <SchoolContextProvider value={value}>{children}</SchoolContextProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    await captureServerException(error, undefined, {
      slug,
      source: "school-route-boundary",
    });

    return <SchoolNotFound />;
  }
}
