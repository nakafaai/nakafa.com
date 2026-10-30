import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  IdCardIcon,
  MailSend01Icon,
  MoreHorizontalIcon,
  UserAdd01Icon,
  UserCircleIcon,
  UserRemove01Icon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { type ComponentProps, startTransition, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import type { StatusTone } from "@/components/shared/table/tone";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import { roleLooks } from "@/components/tenant/roles";
import { removeMemberChange } from "@/components/tenant/settings/accounts";
import { SchoolGrantDialog } from "@/components/tenant/settings/grant";
import { SchoolInviteAction } from "@/components/tenant/settings/invite";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";

const SOURCE = "components/tenant/settings/members";

/**
 * How each member status shows, in the list and in its column's filter: an icon that fits it and that no
 * other status shares, and the tone of its badge. A member who still needs an invitation stands out,
 * a joined member reads as done.
 */
const STATUS_LOOKS = {
  cardIssued: { icon: IdCardIcon, tone: "primary" },
  invited: { icon: MailSend01Icon, tone: "info" },
  joined: { icon: UserCircleIcon, tone: "success" },
  notInvited: { icon: UserAdd01Icon, tone: "warning" },
} as const satisfies Record<
  MemberStatus,
  {
    icon: ComponentProps<typeof HugeIcons>["icon"];
    tone: typeof StatusTone.Type;
  }
>;

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
 * Every active member of the school as the page's table: its name, how far it has joined, its
 * roles, and its menu. The header row searches the names and holds Invite, the page's main action,
 * and the status column filters the rows by status. The list loads more rows as its end comes into view.
 */
export function SchoolMembersSettings() {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("members-search")} />
            <SchoolInviteAction />
          </>
        }
      >
        <ReadBoundary>
          <SchoolMembersBody />
        </ReadBoundary>
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The members of the school, read a page at a time, with the table and its end. */
function SchoolMembersBody() {
  const { slug } = useTenant();
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
        <SchoolMemberTable members={pagination.results} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The members in a data table, or the table's empty state when the school has none. */
function SchoolMemberTable({ members }: { members: readonly MemberItem[] }) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");

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
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`member-status-label.${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(MemberStatus.literals, (status) => ({
            icon: STATUS_LOOKS[status].icon,
            label: t(`member-status-label.${status}`),
            value: status,
          }))}
          title={t("member-status")}
        />
      ),
      id: "status",
      meta: { align: "center" },
    }),
    memberColumns.accessor((member) => member.roles, {
      cell: (info) => (
        <div className="inline-flex items-center gap-1 whitespace-nowrap">
          {Arr.map(info.getValue(), (role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      ),
      enableSorting: false,
      filterFn: "anyOf",
      header: () => (
        <ColumnFilter
          column="roles"
          options={Arr.map(
            Arr.dedupe(Arr.flatMap(members, (member) => member.roles)),
            (role) => ({
              icon: roleLooks[role].icon,
              label: tSchool(`role.${role}`),
              value: role,
            })
          )}
          title={t("member-roles")}
        />
      ),
      id: "roles",
      meta: { align: "center" },
    }),
    memberColumns.display({
      cell: (info) => <SchoolMemberMenu member={info.row.original} />,
      id: "actions",
      meta: { align: "end" },
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
 * The row menu of a member: Give a role, which gives the member a role of the whole school, and Remove for a member
 * whom the viewer may remove, one who joined, one whose card waits, and one whose invite ended or card expired. Remove
 * asks first, and the account of a member who joined loses the school at once. An invited member is handled on the
 * invitations page, and the list answers which rows the viewer may remove.
 */
function SchoolMemberMenu({ member }: { member: MemberItem }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const remove = useMutation(tenancy.people.remove).withOptimisticUpdate(
    removeMemberChange
  );
  const [isGiving, setIsGiving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const removable = member.removable && member.status !== "invited";

  const removeMember = () => {
    setIsRemoving(false);
    startTransition(() =>
      saveSchool(() => remove({ personId: member.id, slug }), SOURCE)
    );
  };

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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setIsGiving(true)}>
              <HugeIcons icon={UserStar01Icon} />
              {t("roles-assign-dialog")}
            </DropdownMenuItem>
            {removable ? (
              <DropdownMenuItem
                onClick={() => setIsRemoving(true)}
                variant="destructive"
              >
                <HugeIcons icon={UserRemove01Icon} />
                {t("member-remove")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SchoolGrantDialog
        open={isGiving}
        person={{ id: member.id, name: member.name }}
        setOpen={setIsGiving}
      />
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
            <Button onClick={removeMember} type="button" variant="destructive">
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
