import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getToken } from "@/lib/auth/server";

/** Resolves the authenticated school landing redirects before rendering children. */
export async function School({ children }: { children: ReactNode }) {
  const token = await getToken();

  if (token) {
    const schools = await fetchQuery(
      api.schools.queries.getMySchools,
      {},
      {
        token,
      }
    );

    if (schools.length === 0) {
      redirect("/school/onboarding");
    }

    if (schools.length === 1) {
      redirect(`/school/${schools[0].slug}`);
    }

    if (schools.length > 1) {
      redirect("/school/select");
    }
  }

  return children;
}
