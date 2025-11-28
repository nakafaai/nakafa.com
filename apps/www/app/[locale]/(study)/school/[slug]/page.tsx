import { api } from "@repo/backend/convex/_generated/api";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { fetchQuery } from "convex/nextjs";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { getToken } from "@/lib/auth/server";

type Props = {
  params: Promise<{ locale: Locale; slug: string }>;
};

export default function Page({ params }: Props) {
  const { locale, slug } = use(params);

  setRequestLocale(locale);

  return (
    <ErrorBoundary fallback={null}>
      <Suspense>
        <PageContent slug={slug} />
      </Suspense>
    </ErrorBoundary>
  );
}

async function PageContent({ slug }: { slug: string }) {
  // Decode URL-encoded characters (e.g., %2c -> ,)
  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // Fallback to original slug if decoding fails
    decodedSlug = slug;
  }

  const token = await getToken();
  const school = await fetchQuery(
    api.schools.queries.getSchoolBySlug,
    {
      slug: decodedSlug,
    },
    { token }
  );

  if (!school) {
    notFound();
  }

  redirect(`/school/${decodedSlug}/dashboard`);

  return null;
}
