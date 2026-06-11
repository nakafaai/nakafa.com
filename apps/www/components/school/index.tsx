import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSchoolLandingRouteState } from "@/lib/school/server";

/**
 * Resolve school landing redirects before rendering the public auth fallback.
 *
 * Unauthenticated requests intentionally render `children`; authenticated
 * landing states redirect into onboarding, a single school, or the switcher.
 */
export async function School({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const landingState = await getSchoolLandingRouteState();

  if (landingState.kind === "unauthenticated") {
    return children;
  }

  if (landingState.kind === "none") {
    redirect(`/${locale}/school/onboarding`);
  }

  if (landingState.kind === "single") {
    redirect(`/${locale}/school/${landingState.slug}`);
  }

  redirect(`/${locale}/school/select`);
}
