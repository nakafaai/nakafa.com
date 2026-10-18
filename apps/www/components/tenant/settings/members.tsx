"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SchoolPlacementMove } from "@/components/tenant/settings/placement";
import type {
  Cohort,
  Member,
  Period,
} from "@/components/tenant/settings/state";

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
          <SchoolMemberMenu
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

/**
 * A student's row menu: its one action moves the student to another cohort of the period,
 * in the dialog the menu opens.
 */
function SchoolMemberMenu({
  cohortId,
  member,
  slug,
  targets,
}: {
  cohortId: Cohort["id"];
  member: Member;
  slug: TenantSlug;
  targets: readonly Cohort[];
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const [isMoving, setIsMoving] = useState(false);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setIsMoving(true)}>
            {t("placement-move")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SchoolPlacementMove
        cohortId={cohortId}
        member={member}
        open={isMoving}
        setOpen={setIsMoving}
        slug={slug}
        targets={targets}
      />
    </div>
  );
}
