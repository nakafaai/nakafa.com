import { api } from "@repo/backend/convex/_generated/api";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { fetchAuthQuery, getToken } from "@/lib/auth/server";

/** Resolves the authenticated school landing redirects before rendering children. */
export async function School({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const token = await getToken();

  if (token) {
    const landingState = await fetchAuthQuery(
      api.schools.queries.getMySchoolLandingState,
      {}
    );

    if (landingState.kind === "none") {
      redirect(`/${locale}/school/onboarding`);
    }

    if (landingState.kind === "single") {
      redirect(`/${locale}/school/${landingState.slug}`);
    }

    if (landingState.kind === "multiple") {
      redirect(`/${locale}/school/select`);
    }
  }

  return children;
}
