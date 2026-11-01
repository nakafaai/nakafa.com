import { QueryResult, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PageFrame } from "@/components/shared/content/frame";
import { pageRowVariants } from "@/components/shared/content/width";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { WithAction } from "@/components/tenant/action";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { SchoolCohortMembers } from "@/components/tenant/settings/cohort/members";
import { SchoolHomeroomCard } from "@/components/tenant/settings/homeroom";
import { SchoolPlacementAdd } from "@/components/tenant/settings/placement";
import type { CohortDetail } from "@/components/tenant/settings/state";
import { TargetLink } from "@/lib/routing/link";
import { getSchoolSettingsSection } from "@/lib/settings/school";

/**
 * One cohort's page: its path and name in the school's one header, with the search of its
 * students and the page's action that places a student at its end, then the homeroom teacher's
 * card and the students of the cohort, both in the settings column.
 * An archived cohort keeps what it holds to read, and offers no action that changes it.
 */
export function SchoolCohortSettings({
  cohortId,
  slug,
}: {
  cohortId: CohortDetail["id"];
  slug: TenantSlug;
}) {
  return (
    <ReadBoundary
      fallback={(failure) => <CohortFailure>{failure}</CohortFailure>}
      read={{ args: { cohortId, slug }, ref: tenancy.cohorts.get }}
    >
      <SchoolCohortPage cohortId={cohortId} slug={slug} />
    </ReadBoundary>
  );
}

/** The header of a cohort page whose read failed: the path to the cohorts, and the failure in the body. */
function CohortFailure({ children }: { children: ReactNode }) {
  const t = useTranslations("SchoolSettings");
  const { reach, slug } = useTenant();
  const section = getSchoolSettingsSection(
    slug,
    "/school/$slug/settings/cohorts",
    reach
  );

  return (
    <PageFrame width="column">
      <SchoolHeader
        items={[
          {
            label: t(section.group.key),
            target: section.group.target,
          },
          { label: t(section.labelKey) },
        ]}
        title={t(section.labelKey)}
      />
      <TablePageBody>{children}</TablePageBody>
    </PageFrame>
  );
}

/**
 * The page of a cohort this school does not hold, a missing or a foreign one: its header, one sentence
 * on why, and the way back to the cohorts list. Trying again cannot change that answer, so there is none.
 */
function CohortUnavailable() {
  const t = useTranslations("SchoolSettings");
  const { reach, slug } = useTenant();
  const section = getSchoolSettingsSection(
    slug,
    "/school/$slug/settings/cohorts",
    reach
  );

  return (
    <PageFrame width="column">
      <SchoolHeader
        items={[
          {
            label: t(section.group.key),
            target: section.group.target,
          },
          { label: t(section.labelKey) },
        ]}
        title={t(section.labelKey)}
      />
      <TablePageBody>
        <TableEmpty
          act="pointing"
          action={
            <TargetLink
              className={buttonVariants({ variant: "outline" })}
              target={section.target}
            >
              {t(section.labelKey)}
            </TargetLink>
          }
          description={t("cohort-unavailable-description")}
          title={t("cohort-unavailable")}
        />
      </TablePageBody>
    </PageFrame>
  );
}

/**
 * One cohort's page, drawn from the first paint: the path with the cohort's place in it, the search, Add student and
 * the homeroom card's frame are there at once and final, and the cohort's name, its homeroom teacher and its students
 * fill in when the cohort is read. Add student's dialog waits for the cohort itself.
 */
function SchoolCohortPage({
  cohortId,
  slug,
}: {
  cohortId: CohortDetail["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const { reach } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohort = useQuery(
    tenancy.cohorts.get,
    isSettled ? { cohortId, slug } : "skip"
  );
  if (QueryResult.isFailure(cohort)) {
    if (isDenied(cohort.error)) {
      return <CohortUnavailable />;
    }
    throw cohort.error;
  }
  const detail = QueryResult.isSuccess(cohort) ? cohort.value : undefined;
  const section = getSchoolSettingsSection(
    slug,
    "/school/$slug/settings/cohorts",
    reach
  );

  return (
    <TableFiltersProvider>
      <PageFrame width="column">
        <SchoolHeader
          items={[
            {
              label: t(section.group.key),
              target: section.group.target,
            },
            {
              label: t(section.labelKey),
              target: section.target,
            },
            { label: detail === undefined ? "" : detail.name },
          ]}
          {...(detail === undefined ? {} : { title: detail.name })}
        >
          <TableSearch placeholder={t("cohort-members-search")} />
          <WithAction action="cohort.manage">
            <SchoolPlacementAdd
              cohortId={cohortId}
              slug={slug}
              status={detail === undefined ? undefined : detail.status}
            />
          </WithAction>
        </SchoolHeader>
        <div className={cn(pageRowVariants(), "pt-4")}>
          <WithAction action="cohort.manage">
            <SchoolHomeroomCard cohort={detail} slug={slug} />
          </WithAction>
        </div>
        <TablePageBody>
          {detail === undefined ? null : (
            <ReadBoundary>
              <SchoolCohortMembers
                cohortId={cohortId}
                isArchived={detail.status === "archived"}
                periodId={detail.periodId}
                slug={slug}
              />
            </ReadBoundary>
          )}
        </TablePageBody>
      </PageFrame>
    </TableFiltersProvider>
  );
}
