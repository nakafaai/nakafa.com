"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SchoolPlacementMove } from "@/components/tenant/settings/placement";
import type { Cohort, Period } from "@/components/tenant/settings/state";

/** How many students one page of the members table loads, and each page after it. */
const PAGE_SIZE = 25;

/** One student as the members table shows them. */
type MemberItem = PaginatedQueryItem<typeof tenancy.cohorts.members>;

/** The columns of the members table. */
const memberColumns = createColumnHelper<
  typeof dataTableFeatures,
  MemberItem
>();

/**
 * Renders the students placed in one cohort in a data table that finds a name, with each
 * student's row menu. The table loads more students as its end comes into view, waits for
 * its first page, and shows an empty state while the cohort holds no student. An archived
 * cohort, or one with no other active cohort to move to, shows no row menu.
 */
export function SchoolCohortMembers({
  cohortId,
  isArchived,
  periodId,
  slug,
}: {
  cohortId: Cohort["id"];
  isArchived: boolean;
  periodId: Period["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    tenancy.cohorts.members,
    { cohortId, slug },
    { initialNumItems: PAGE_SIZE }
  );
  const cohorts = useQuery(tenancy.cohorts.list, { periodId, slug });

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <TableEmpty
        act="reading"
        description={t("members-description")}
        title={t("members-empty")}
      />
    );
  }

  const targets = QueryResult.isSuccess(cohorts)
    ? Arr.filter(
        cohorts.value,
        (cohort) => cohort.id !== cohortId && cohort.status === "active"
      )
    : [];
  const canMove = !isArchived && Arr.isReadonlyArrayNonEmpty(targets);
  const columns = memberColumns.columns([
    memberColumns.accessor((member) => member.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("member-name"),
      id: "name",
      sortFn: "text",
    }),
    memberColumns.display({
      cell: (info) =>
        canMove ? (
          <SchoolPlacementMove
            cohortId={cohortId}
            member={info.row.original}
            slug={slug}
            targets={targets}
          />
        ) : null,
      id: "actions",
    }),
  ]);

  return (
    <>
      <DataTable
        columns={columns}
        data={pagination.results}
        rowId={(member) => member.id}
        search={{ column: "name", placeholder: t("members-search") }}
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}
