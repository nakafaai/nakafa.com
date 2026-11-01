import {
  type PaginatedQueryItem,
  QueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  IdCardIcon,
  MailSend01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  UserAdd01Icon,
  UserCircleIcon,
  UserRemove01Icon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { MemberStatus } from "@repo/backend/confect/tenancy/roster";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import type { StatusTone } from "@repo/design-system/lib/status";
import { Array as Arr, Option, Schema } from "effect";
import { type ComponentProps, startTransition, useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useDialogs } from "@/components/shared/dialogs";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { TablePages } from "@/components/shared/table/pages";
import { TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { WithAction } from "@/components/tenant/action";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { LineDialog } from "@/components/tenant/line";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import { roleLooks } from "@/components/tenant/roles";
import { removeMemberChange } from "@/components/tenant/settings/accounts";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import { UNIT_ICONS } from "@/components/tenant/settings/choices";
import { SchoolGrantDialog } from "@/components/tenant/settings/grant";
import { inviteChange } from "@/components/tenant/settings/grants";
import { SchoolInviteAction } from "@/components/tenant/settings/invite";
import { SchoolIssueCardDialog } from "@/components/tenant/settings/issue";
import { cardOffered } from "@/components/tenant/settings/offer";
import { PersonRenameDialog } from "@/components/tenant/settings/rename";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";

const SOURCE = "components/tenant/settings/members";

/**
 * How each member status shows, in the list and in its column's filter: an icon that fits it and that no
 * other status shares, and the tone of its badge. A member who still needs an invitation stands out,
 * a joined member reads as done.
 */
const STATUS_LOOKS = {
  cardIssued: { icon: IdCardIcon, tone: "info" },
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
const memberColumns = tableColumns<MemberItem>();

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
            <WithAction action="person.manage">
              <SchoolInviteAction />
            </WithAction>
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

  return (
    <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
      <SchoolMemberTable members={pagination.results} />
    </TablePages>
  );
}

/** The members in a data table, or the table's empty state when the school has none. */
function SchoolMemberTable({ members }: { members: readonly MemberItem[] }) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const viewer = useViewerQuery();

  const unitsOf = (member: MemberItem) =>
    QueryResult.isSuccess(viewer)
      ? Arr.map(
          Arr.filter(viewer.value.units, (unit) =>
            Arr.contains(member.units, unit.id)
          ),
          (unit) => unit.name
        )
      : [];
  const columns = [
    memberColumns.text((member) => member.name, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      header: t("member-name"),
      id: "name",
    }),
    memberColumns.text((member) => member.email ?? "", {
      header: t("member-email"),
      id: "email",
    }),
    memberColumns.list(unitsOf, {
      cell: (info) => <span dir="auto">{Arr.join(info.getValue(), ", ")}</span>,
      header: t("member-units"),
      id: "units",
      options: namedOptions(
        Arr.dedupe(Arr.flatMap(members, unitsOf)),
        UNIT_ICONS
      ),
    }),
    memberColumns.values((member) => member.status, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`member-status-label.${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("member-status"),
      id: "status",
      options: Arr.map(MemberStatus.literals, (status) => ({
        icon: STATUS_LOOKS[status].icon,
        label: t(`member-status-label.${status}`),
        value: status,
      })),
    }),
    memberColumns.list((member) => member.roles, {
      cell: (info) => (
        <div className="inline-flex flex-wrap justify-center gap-1">
          {Arr.map(info.getValue(), (role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      ),
      header: t("member-roles"),
      id: "roles",
      options: Arr.map(
        Arr.dedupe(Arr.flatMap(members, (member) => member.roles)),
        (role) => ({
          icon: roleLooks[role].icon,
          label: tSchool(`role.${role}`),
          value: role,
        })
      ),
    }),
    memberColumns.menu((info) => (
      <WithAction action="person.manage">
        <SchoolMemberMenu member={info.row.original} />
      </WithAction>
    )),
  ];

  return (
    <DataTable
      columns={columns}
      data={members}
      empty={
        <TableEmpty
          act="waving"
          description={t("members-empty-description")}
          title={t("members-empty")}
        />
      }
      rowId={(member) => member.id}
      search="name"
    />
  );
}

/**
 * The row menu of a member: Rename, Give a role, which gives the member a role of the whole school, Invite and a login
 * card for a member nothing waits for yet, such as a student an import added, who may have no address, and Remove for a member whom the viewer may remove, one who
 * joined, one whose card waits, and one whose invite ended or card expired. Remove asks first, and the account of a member
 * who joined loses the school at once. An invited member is handled on the invitations page, and the list answers which
 * rows the viewer may remove.
 */
function SchoolMemberMenu({ member }: { member: MemberItem }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const sendLocale = Option.getOrUndefined(
    Schema.decodeOption(ActiveAppLocaleCodeSchema)(useLocale())
  );
  const invite = useMutation(tenancy.invites.invite).withOptimisticUpdate(
    inviteChange
  );
  const remove = useMutation(tenancy.people.remove).withOptimisticUpdate(
    removeMemberChange
  );
  const dialogs = useDialogs<
    "card" | "give" | "invite" | "remove" | "rename"
  >();
  const [issued, setIssued] = useState<CardView | undefined>(undefined);
  const removable = member.removable && member.status !== "invited";

  /** Invites the member at the address typed, in the viewer's language. */
  const inviteAt = (value: string) => {
    const email = Schema.decodeOption(Email)(value);
    if (sendLocale === undefined || Option.isNone(email)) {
      return;
    }
    startTransition(() =>
      saveSchool(
        () =>
          invite({
            email: email.value,
            locale: sendLocale,
            personId: member.id,
            slug,
          }),
        SOURCE
      )
    );
  };

  const removeMember = () => {
    dialogs.close();
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
            <DropdownMenuItem onClick={() => dialogs.show("rename")}>
              <HugeIcons icon={PencilEdit02Icon} />
              {t("person-rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => dialogs.show("give")}>
              <HugeIcons icon={UserStar01Icon} />
              {t("roles-assign-dialog")}
            </DropdownMenuItem>
            {member.status === "notInvited" ? (
              <DropdownMenuItem
                disabled={sendLocale === undefined}
                onClick={() => dialogs.show("invite")}
              >
                <HugeIcons icon={MailSend01Icon} />
                {t("invite-action")}
              </DropdownMenuItem>
            ) : null}
            {member.status === "notInvited" && cardOffered(member.roles) ? (
              <DropdownMenuItem onClick={() => dialogs.show("card")}>
                <HugeIcons icon={IdCardIcon} />
                {t("invite-card")}
              </DropdownMenuItem>
            ) : null}
            {removable ? (
              <DropdownMenuItem
                onClick={() => dialogs.show("remove")}
                variant="destructive"
              >
                <HugeIcons icon={UserRemove01Icon} />
                {t("member-remove")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs.kind === "rename" ? (
        <PersonRenameDialog
          key={dialogs.key}
          open={dialogs.isOpen("rename")}
          person={member}
          setOpen={dialogs.setOpen}
        />
      ) : null}
      <SchoolGrantDialog
        open={dialogs.isOpen("give")}
        person={{ id: member.id, name: member.name }}
        setOpen={dialogs.setOpen}
      />
      {dialogs.kind === "invite" ? (
        <LineDialog
          action={t("invite-submit")}
          description={t("invite-dialog-description")}
          initial=""
          isValid={Schema.is(Email)}
          key={dialogs.key}
          label={t("invite-email")}
          onSave={inviteAt}
          open={dialogs.isOpen("invite")}
          placeholder={t("invite-email-placeholder")}
          setOpen={dialogs.setOpen}
          title={t("invite-dialog-title")}
          type="email"
        />
      ) : null}
      <SchoolIssueCardDialog
        name={member.name}
        onIssued={setIssued}
        open={dialogs.isOpen("card")}
        personId={member.id}
        setOpen={dialogs.setOpen}
        slug={slug}
      />
      <SchoolCardDialog card={issued} onClose={() => setIssued(undefined)} />
      <ResponsiveDialog
        description={t("member-remove-description")}
        footer={
          <>
            <Button onClick={dialogs.close} type="button" variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={removeMember} type="button" variant="destructive">
              {t("member-remove-confirm")}
            </Button>
          </>
        }
        open={dialogs.isOpen("remove")}
        setOpen={dialogs.setOpen}
        title={t("member-remove-title")}
      />
    </div>
  );
}
