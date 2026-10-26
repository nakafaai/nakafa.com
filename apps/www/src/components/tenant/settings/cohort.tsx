import { QueryResult } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createContext, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { TableEmpty } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { SchoolCohortMembers } from "@/components/tenant/settings/cohort/members";
import { SchoolHomeroomCard } from "@/components/tenant/settings/homeroom";
import { SchoolPlacementAdd } from "@/components/tenant/settings/placement";
import type { CohortDetail } from "@/components/tenant/settings/state";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { TargetLink } from "@/lib/routing/link";
import { getSchoolSettingsSection } from "@/lib/settings/school";
import type { readCohortFn } from "@/lib/tenant/settings.functions";

/**
 * The first screen of one cohort page, which its loader read on the server: the cohort, the first page of its
 * members, and the cohorts of its period, which the cohort's move menu lists.
 */
type CohortPreload = Partial<
  Pick<
    Awaited<ReturnType<typeof readCohortFn>>,
    "cohorts" | "detail" | "members"
  >
>;

/** The first screen of one cohort page, which the page's loader read on the server. */
const CohortPreloadContext = createContext<CohortPreload | undefined>(
  undefined
);

/**
 * One cohort's page: its path and name in the school's one header, with the page's action
 * that places a student at its end, then the homeroom teacher and the students of the cohort.
 * An archived cohort keeps what it holds to read, and offers no action that changes it.
 */
export function SchoolCohortSettings({
  cohortId,
  preload,
  slug,
}: {
  cohortId: CohortDetail["id"];
  preload: CohortPreload | undefined;
  slug: TenantSlug;
}) {
  return (
    <ReadBoundary
      fallback={(failure) => <CohortFailure>{failure}</CohortFailure>}
      read={{ args: { cohortId, slug }, ref: tenancy.cohorts.get }}
    >
      <CohortPreloadContext value={preload}>
        <SchoolCohortPage cohortId={cohortId} slug={slug} />
      </CohortPreloadContext>
    </ReadBoundary>
  );
}

/** The header of a cohort page whose read failed: the path to the cohorts, and the failure in the body. */
function CohortFailure({ children }: { children: ReactNode }) {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const section = getSchoolSettingsSection(
    slug,
    "/school/$slug/settings/cohorts"
  );

  return (
    <>
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
      <LayoutContent className="py-6">{children}</LayoutContent>
    </>
  );
}

/**
 * The page of a cohort this school does not hold, a missing or a foreign one: its header, one sentence
 * on why, and the way back to the cohorts list. Trying again cannot change that answer, so there is none.
 */
function CohortUnavailable() {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const section = getSchoolSettingsSection(
    slug,
    "/school/$slug/settings/cohorts"
  );

  return (
    <>
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
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
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
      </LayoutContent>
    </>
  );
}

/** One cohort's page once the cohort is read. */
function SchoolCohortPage({
  cohortId,
  slug,
}: {
  cohortId: CohortDetail["id"];
  slug: TenantSlug;
}) {
  const preload = use(CohortPreloadContext);
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohort = usePreloadedQueryResult(
    tenancy.cohorts.get,
    isSettled ? { cohortId, slug } : "skip",
    preload?.detail
  );
  if (QueryResult.isFailure(cohort)) {
    if (isDenied(cohort.error)) {
      return <CohortUnavailable />;
    }
    throw cohort.error;
  }
  if (!QueryResult.isSuccess(cohort)) {
    return null;
  }
  const detail = cohort.value;
  const isArchived = detail.status === "archived";
  const section = getSchoolSettingsSection(
    slug,
    "/school/$slug/settings/cohorts"
  );

  return (
    <>
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
          { label: detail.name },
        ]}
        title={detail.name}
      >
        {isArchived ? null : (
          <SchoolPlacementAdd cohortId={cohortId} slug={slug} />
        )}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        <SchoolHomeroomCard cohort={detail} slug={slug} />
        <ReadBoundary>
          <SchoolCohortMembers
            cohortId={cohortId}
            cohorts={preload?.cohorts}
            first={preload?.members}
            isArchived={isArchived}
            periodId={detail.periodId}
            slug={slug}
          />
        </ReadBoundary>
      </LayoutContent>
    </>
  );
}
