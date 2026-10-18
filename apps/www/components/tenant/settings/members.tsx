"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { RoleBadge } from "@/components/tenant/role";
import { SettingsPage } from "@/components/tenant/settings/page";

/** How many members one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One member of the school as the members list shows it. */
type MemberItem = PaginatedQueryItem<typeof tenancy.roster.members>;

/** The columns of the members table. */
const memberColumns = createColumnHelper<
  typeof dataTableFeatures,
  MemberItem
>();

/**
 * Every active member of the school in a data table: its name, how far it has joined,
 * and its roles as badges. The table filters by name and by status, and loads more
 * rows as its end comes into view. Invitations are sent on the invitations page.
 */
export function SchoolMembersSettings({ slug }: { slug: TenantSlug }) {
  const pagination = usePaginatedQuery(
    tenancy.roster.members,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <SettingsPage>
      {pagination._tag === "LoadingFirstPage" ? null : (
        <SchoolMemberTable members={pagination.results} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </SettingsPage>
  );
}

/** The members in a data table, or the table's empty state when the school has none. */
function SchoolMemberTable({ members }: { members: readonly MemberItem[] }) {
  const t = useTranslations("SchoolSettings");

  if (Arr.isReadonlyArrayEmpty(members)) {
    return (
      <TableEmpty
        act="waving"
        description={t("members-empty-description")}
        title={t("members-empty")}
      />
    );
  }

  const columns = memberColumns.columns([
    memberColumns.accessor((member) => member.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("member-name"),
      id: "name",
      sortFn: "text",
    }),
    memberColumns.accessor((member) => member.status, {
      cell: (info) => t(`member-status-label.${info.getValue()}`),
      filterFn: "oneOf",
      header: t("member-status"),
      id: "status",
      sortFn: "text",
    }),
    memberColumns.display({
      cell: (info) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          {Arr.map(info.row.original.roles, (role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      ),
      header: t("member-roles"),
      id: "roles",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={members}
      facets={[
        {
          column: "status",
          options: Arr.map(MemberStatus.literals, (status) => ({
            label: t(`member-status-label.${status}`),
            value: status,
          })),
          title: t("member-status"),
        },
      ]}
      rowId={(member) => member.id}
      search={{ column: "name", placeholder: t("members-search") }}
    />
  );
}
