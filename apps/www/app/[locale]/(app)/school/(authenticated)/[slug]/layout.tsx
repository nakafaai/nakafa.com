import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, use } from "react";
import { SchoolContextProvider } from "@/lib/context/use-school";
import {
  getSchoolInfoBySlug,
  getSchoolRouteSnapshot,
} from "@/lib/school/server";

const getSchoolInfo = cache(getSchoolInfoBySlug);

export async function generateMetadata({
  params,
}: {
  params: LayoutProps<"/[locale]/school/[slug]">["params"];
}): Promise<Metadata> {
  const { slug } = await params;
  const defaultMetadata = {};

  const schoolInfo = await getSchoolInfo(slug);

  if (!schoolInfo) {
    return defaultMetadata;
  }

  return {
    title: {
      absolute: schoolInfo.name,
    },
  };
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
  const value = await getSchoolRouteSnapshot({ slug });

  if (!value) {
    notFound();
  }

  return (
    <SchoolContextProvider value={value}>{children}</SchoolContextProvider>
  );
}
