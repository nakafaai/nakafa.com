import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { notFound } from "next/navigation";
import { SchoolCohortSettings } from "@/components/tenant/settings/cohort";

/** One cohort of the school: its homeroom teacher, and the students placed in it. */
export default async function SchoolCohortPage({
  params,
}: PageProps<"/[locale]/school/[slug]/settings/cohorts/[cohort]">) {
  const { cohort, slug } = await params;
  if (
    !(Schema.is(TenantSlug)(slug) && Schema.is(Id("tenantCohorts"))(cohort))
  ) {
    notFound();
  }
  return <SchoolCohortSettings cohortId={cohort} slug={slug} />;
}
