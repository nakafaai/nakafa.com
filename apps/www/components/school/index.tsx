import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth/server";

interface Props {
  /**
   * The children is the landing page for Nakafa School.
   */
  children: React.ReactNode;
}

export async function School({ children }: Props) {
  const token = await getToken();

  if (token) {
    const memberships = await fetchQuery(
      api.schools.queries.getSchoolMemberships,
      {},
      { token }
    );

    if (memberships.length === 0) {
      redirect("/school/onboarding");
    }

    // If has 1 school membership, redirect to school page
    if (memberships.length === 1) {
      const membership = memberships[0];
      const school = await fetchQuery(
        api.schools.queries.getSchool,
        { schoolId: membership.schoolId },
        { token }
      );
      if (school) {
        redirect(`/school/${school.slug}`);
      }
    }

    // If has multiple school memberships, redirect to school selection page
    if (memberships.length > 1) {
      redirect("/school/select");
    }
  }

  return children;
}
