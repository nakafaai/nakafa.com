"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Schema } from "effect";
import { useTranslations } from "next-intl";
import { type ReactNode, startTransition, useId, useState } from "react";
import { LayoutContent } from "@/components/shared/content/layout";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  archiveCohortChange,
  renameCohortChange,
} from "@/components/tenant/settings/cohorts.client";
import { SchoolHomeroomCard } from "@/components/tenant/settings/homeroom";
import {
  SchoolPlacementAdd,
  SchoolPlacementMove,
} from "@/components/tenant/settings/placement";
import { saveSchool } from "@/components/tenant/settings/save.client";
import {
  type Cohort,
  type CohortDetail,
  isDraft,
  type Period,
} from "@/components/tenant/settings/state";
import { getSchoolSettingsSection } from "@/lib/settings/school";

const SOURCE = "components/tenant/settings/cohort";

/**
 * A cohort's row menu: it renames the cohort in a dialog that saves only a name the cohort
 * does not have yet, or archives it. An archived cohort has no menu, because the server
 * refuses every write to it, so its cell stays empty.
 */
export function SchoolCohortMenu({
  cohort,
  slug,
}: {
  cohort: Cohort;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const archive = useMutation(tenancy.cohorts.archive).withOptimisticUpdate(
    archiveCohortChange
  );
  const rename = useMutation(tenancy.cohorts.rename).withOptimisticUpdate(
    renameCohortChange
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(cohort.name);
  const next = name.trim();
  const canSave = next !== cohort.name && Schema.is(CohortName)(next);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(cohort.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setName(cohort.name);
              setIsRenaming(true);
            }}
          >
            {t("cohort-rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              startTransition(() =>
                saveSchool(() => archive({ cohortId: cohort.id, slug }), SOURCE)
              )
            }
          >
            {t("cohort-archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        footer={
          <>
            <Button
              onClick={() => setIsRenaming(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => {
                setIsRenaming(false);
                startTransition(() =>
                  saveSchool(
                    () => rename({ cohortId: cohort.id, name: next, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
            >
              {t("cohort-rename-save")}
            </Button>
          </>
        }
        open={isRenaming}
        setOpen={setIsRenaming}
        title={t("cohort-rename")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("cohort-name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </div>
  );
}

/**
 * One cohort's page: its path and name in the school's one header, with the page's action
 * that places a student at its end, then the homeroom teacher and the students of the cohort.
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
  const section = getSchoolSettingsSection("/settings/cohorts");

  return (
    <>
      <SchoolHeader
        items={[
          { href: section.group.href, label: t(section.group.key) },
          { label: t(section.labelKey) },
        ]}
        title={t(section.labelKey)}
      />
      <LayoutContent className="py-6">{children}</LayoutContent>
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
  const t = useTranslations("SchoolSettings");
  const cohort = useQuery(tenancy.cohorts.get, { cohortId, slug });
  if (QueryResult.isFailure(cohort)) {
    throw cohort.error;
  }
  if (!QueryResult.isSuccess(cohort)) {
    return null;
  }
  const detail = cohort.value;
  const isArchived = detail.status === "archived";
  const section = getSchoolSettingsSection("/settings/cohorts");

  return (
    <>
      <SchoolHeader
        items={[
          { href: section.group.href, label: t(section.group.key) },
          { href: section.href, label: t(section.labelKey) },
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
            isArchived={isArchived}
            periodId={detail.periodId}
            slug={slug}
          />
        </ReadBoundary>
      </LayoutContent>
    </>
  );
}

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
function SchoolCohortMembers({
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
        description={t("cohort-members-description")}
        title={t("cohort-members-empty")}
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
        search={{ column: "name", placeholder: t("cohort-members-search") }}
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}
