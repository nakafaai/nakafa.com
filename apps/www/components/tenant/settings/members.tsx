"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
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
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import { removeMemberChange } from "@/components/tenant/settings/members.client";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/members";

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
 * and its roles as badges. A member who is not invited has a row menu that removes it.
 * The table filters by name and by status, and loads more rows as its end comes into
 * view. Invitations are sent on the invitations page.
 */
export function SchoolMembersSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <ReadBoundary>
        <SchoolMembersBody slug={slug} />
      </ReadBoundary>
    </SettingsPage>
  );
}

/** The members of the school, read a page at a time, with the table and its end. */
function SchoolMembersBody({ slug }: { slug: TenantSlug }) {
  const pagination = usePaginatedQuery(
    tenancy.roster.members,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <>
      {pagination._tag === "LoadingFirstPage" ? null : (
        <SchoolMemberTable members={pagination.results} slug={slug} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The members in a data table, or the table's empty state when the school has none. */
function SchoolMemberTable({
  members,
  slug,
}: {
  members: readonly MemberItem[];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");

  if (Arr.isReadonlyArrayEmpty(members)) {
    return (
      <TableEmpty
        act="waving"
        action={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/settings/invites"
          >
            {t("members-empty-action")}
          </Link>
        }
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
    memberColumns.display({
      cell: (info) =>
        info.row.original.status === "notInvited" ? (
          <SchoolMemberMenu member={info.row.original} slug={slug} />
        ) : null,
      id: "actions",
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

/**
 * The row menu of a member who is not invited, because its invite ended or its card
 * expired. It removes the member behind a confirmation. An invited member is handled on
 * the invitations page, and a joined member has no menu here.
 */
function SchoolMemberMenu({
  member,
  slug,
}: {
  member: MemberItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const remove = useMutation(tenancy.people.remove).withOptimisticUpdate(
    removeMemberChange
  );
  const [isRemoving, setIsRemoving] = useState(false);

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
          <DropdownMenuItem
            onClick={() => setIsRemoving(true)}
            variant="destructive"
          >
            {t("member-remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("member-remove-description")}
        footer={
          <>
            <Button
              onClick={() => setIsRemoving(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setIsRemoving(false);
                startTransition(() =>
                  saveSchool(
                    () => remove({ personId: member.id, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
              variant="destructive"
            >
              {t("member-remove-confirm")}
            </Button>
          </>
        }
        open={isRemoving}
        setOpen={setIsRemoving}
        title={t("member-remove-title")}
      />
    </div>
  );
}
