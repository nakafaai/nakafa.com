import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
} from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext, startTransition, use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ConfirmRowMenu } from "@/components/shared/table/confirm";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import { removeMemberChange } from "@/components/tenant/settings/accounts";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsPage } from "@/components/tenant/settings/section";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/settings/members";

/** How many members one page of the list loads, and each page after it. */
export const PAGE_SIZE = 25;

/** The first page of the list, which its loader read on the server. */
type MembersFirstPage = PreloadedPage<
  PaginatedQueryItem<typeof tenancy.roster.members>
>;

/** One member of the school as the members list shows it. */
type MemberItem = PaginatedQueryItem<typeof tenancy.roster.members>;

/** The columns of the members table. */
const memberColumns = createColumnHelper<
  typeof dataTableFeatures,
  MemberItem
>();

/** The first page of the members, which the page's loader read on the server. */
const MembersFirstPageContext = createContext<MembersFirstPage | undefined>(
  undefined
);

/**
 * Every active member of the school in a data table: its name, how far it has joined,
 * and its roles as badges. A member who is not invited has a row menu that removes it.
 * The table filters by name and by status, and loads more rows as its end comes into
 * view. Invitations are sent on the invitations page.
 */
export function SchoolMembersSettings({
  first,
  slug,
}: {
  first: MembersFirstPage | undefined;
  slug: TenantSlug;
}) {
  return (
    <SettingsPage>
      <ReadBoundary>
        <MembersFirstPageContext value={first}>
          <SchoolMembersBody slug={slug} />
        </MembersFirstPageContext>
      </ReadBoundary>
    </SettingsPage>
  );
}

/** The members of the school, read a page at a time, with the table and its end. */
function SchoolMembersBody({ slug }: { slug: TenantSlug }) {
  const first = use(MembersFirstPageContext);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    tenancy.roster.members,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE },
    Option.fromUndefinedOr(first)
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
        action={
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ slug }}
            to="/school/$slug/settings/invites"
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
  const remove = useMutation(tenancy.people.remove).withOptimisticUpdate(
    removeMemberChange
  );

  return (
    <ConfirmRowMenu
      action={t("member-remove")}
      confirm={t("member-remove-confirm")}
      description={t("member-remove-description")}
      onConfirm={() =>
        startTransition(() =>
          saveSchool(() => remove({ personId: member.id, slug }), SOURCE)
        )
      }
      title={t("member-remove-title")}
    />
  );
}
