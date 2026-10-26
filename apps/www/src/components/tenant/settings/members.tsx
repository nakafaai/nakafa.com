import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { UserCircleIcon, UserRemove01Icon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { startTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFilter,
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import { removeMemberChange } from "@/components/tenant/settings/accounts";
import { SchoolInviteAction } from "@/components/tenant/settings/invite";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";

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
 * Every active member of the school as the page's table: its name, how far it has joined,
 * and its roles. The header row searches the names, filters by status, and holds Invite,
 * the page's main action. The list loads more rows as its end comes into view.
 */
export function SchoolMembersSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("members-search")} />
            <TableFilter
              facets={[
                {
                  column: "status",
                  icon: UserCircleIcon,
                  options: Arr.map(MemberStatus.literals, (status) => ({
                    label: t(`member-status-label.${status}`),
                    value: status,
                  })),
                  title: t("member-status"),
                },
              ]}
            />
            <SchoolInviteAction slug={slug} />
          </>
        }
      >
        <ReadBoundary>
          <SchoolMembersBody slug={slug} />
        </ReadBoundary>
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The members of the school, read a page at a time, with the table and its end. */
function SchoolMembersBody({ slug }: { slug: TenantSlug }) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    tenancy.roster.members,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {pagination._tag === "LoadingFirstPage" ||
      (failed && Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
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
      rowId={(member) => member.id}
      search="name"
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
  const remove = useMutation(tenancy.people.remove).withOptimisticUpdate(
    removeMemberChange
  );

  return (
    <ConfirmRowMenu
      action={t("member-remove")}
      confirm={t("member-remove-confirm")}
      description={t("member-remove-description")}
      icon={UserRemove01Icon}
      onConfirm={() =>
        startTransition(() =>
          saveSchool(() => remove({ personId: member.id, slug }), SOURCE)
        )
      }
      title={t("member-remove-title")}
    />
  );
}
