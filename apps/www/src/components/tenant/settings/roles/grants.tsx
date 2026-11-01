import {
  type PaginatedQueryItem,
  QueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Delete02Icon,
  UserEdit01Icon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { startTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useDialogs } from "@/components/shared/dialogs";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { TableText } from "@/components/shared/table/text";
import { TableName } from "@/components/shared/table/title";
import { useServerSearch } from "@/components/shared/table/toolbar";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { RoleBadge } from "@/components/tenant/role";
import { roleIcon } from "@/components/tenant/roles";
import { SchoolGrantDialog } from "@/components/tenant/settings/grant";
import { revokeGrantChange } from "@/components/tenant/settings/grants";
import { SchoolRoleChangeDialog } from "@/components/tenant/settings/roles/change";
import { saveSchool } from "@/components/tenant/settings/save";
import { scopeNameOf, scopeOptions } from "@/components/tenant/settings/scope";
import { isDraft } from "@/components/tenant/settings/state";
import { useKeptRows } from "@/lib/data/kept";

const SOURCE = "components/tenant/settings/roles/grants";

/** How many grants the table reads each time its end comes near. */
const PAGE_SIZE = 25;

/** One active grant of the school as the grants list shows it. */
type GrantItem = PaginatedQueryItem<typeof access.grants.list>;

/** The columns of the grants table. */
const grantColumns = tableColumns<GrantItem>();

/**
 * The grants of the school, read a page at a time, in a data table that finds a person, filters by
 * role and by what a grant covers in those columns, and gives each revocable grant its menu, or the
 * table's empty state when no one holds a role.
 */
export function SchoolGrantTable() {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const viewer = useViewerQuery();
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const search = useServerSearch();
  const pagination = usePaginatedQuery(
    access.grants.list,
    isSettled ? { slug, ...(search === "" ? {} : { search }) } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  // A new search's first page loads behind the rows the table shows, so the table never blanks.
  const kept = useKeptRows(
    pagination._tag === "LoadingFirstPage",
    pagination.results
  );

  /** What a grant covers, by name: the whole school or one unit. */
  const scopeName = (grant: GrantItem) =>
    QueryResult.isSuccess(viewer)
      ? scopeNameOf(grant.scope, viewer.value.tenant.name, viewer.value.units)
      : "";
  const columns = [
    grantColumns.text((grant) => grant.person.name, {
      cell: (info) => <TableName>{info.getValue()}</TableName>,
      header: t("grant-person"),
      id: "person",
    }),
    grantColumns.text((grant) => grant.person.email ?? "", {
      cell: (info) => <TableText>{info.getValue()}</TableText>,
      header: t("member-email"),
      id: "email",
    }),
    grantColumns.values((grant) => grant.role.key, {
      cell: (info) => <RoleBadge role={info.getValue()} />,
      header: t("grant-role"),
      id: "role",
      options: Arr.map(BuiltinRole.literals, (role) => ({
        icon: roleIcon(role),
        label: tSchool(`role.${role}`),
        value: role,
      })),
    }),
    grantColumns.values(scopeName, {
      header: t("grant-scope"),
      id: "scope",
      options: QueryResult.isSuccess(viewer)
        ? scopeOptions(viewer.value.tenant.name, viewer.value.units)
        : [],
    }),
    grantColumns.menu((info) => <SchoolGrantMenu grant={info.row.original} />, {
      inert: (row) => isDraft(row.id),
    }),
  ];

  return (
    <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
      <DataTable
        columns={columns}
        data={Option.getOrElse(kept, () => [])}
        empty={
          <TableEmpty
            act="juggling"
            description={t("roles-grants-description")}
            title={t("roles-empty")}
          />
        }
        rowId={(grant) => grant.id}
      />
    </TablePages>
  );
}

/**
 * A grant's row menu: Give a role, which opens the grant dialog for the grant's person, Change role, which swaps the
 * role in one step, and Revoke, which revokes the grant behind a confirmation. A grant that keeps the school's last
 * Owner can end in neither way, so its Change role and its Revoke are disabled. A draft grant, still on its way to the server, has an inert menu. Revoking the viewer's own grant may end the
 * role that opens the settings, so the page first leaves for the notifications, which every member keeps, and the
 * revoke follows there with one sentence: the settings page never turns into a refusal under the viewer. Once the role
 * has ended, the school's root, read afresh, lands the viewer on the main page of the role they keep.
 */
function SchoolGrantMenu({ grant }: { grant: GrantItem }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const revoke = useMutation(access.grants.revoke).withOptimisticUpdate(
    revokeGrantChange
  );
  const viewer = useViewerQuery();
  const navigate = useNavigate();
  const router = useRouter();
  const dialogs = useDialogs<"change" | "give" | "revoke">();
  const own =
    QueryResult.isSuccess(viewer) && viewer.value.person.id === grant.person.id;

  return (
    <>
      <RowItems>
        <DropdownMenuItem onClick={() => dialogs.show("give")}>
          <HugeIcons icon={UserStar01Icon} />
          {t("roles-assign-dialog")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!grant.revocable}
          onClick={() => dialogs.show("change")}
        >
          <HugeIcons icon={UserEdit01Icon} />
          {t("grant-change")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!grant.revocable}
          onClick={() => dialogs.show("revoke")}
          variant="destructive"
        >
          <HugeIcons icon={Delete02Icon} />
          {t("grant-revoke")}
        </DropdownMenuItem>
      </RowItems>
      <SchoolGrantDialog
        open={dialogs.isOpen("give")}
        person={grant.person}
        setOpen={dialogs.setOpen}
      />
      {dialogs.kind === "change" ? (
        <SchoolRoleChangeDialog
          grant={grant}
          key={dialogs.key}
          open={dialogs.isOpen("change")}
          setOpen={dialogs.setOpen}
        />
      ) : null}
      <ResponsiveDialog
        description={t("grant-revoke-description")}
        footer={
          <>
            <Button onClick={dialogs.close} type="button" variant="outline">
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                dialogs.close();
                startTransition(async () => {
                  if (own) {
                    await navigate({
                      params: { slug },
                      replace: true,
                      to: "/school/$slug/notifications",
                    });
                  }
                  // The saved revoke marks the role as ended, so the page lands on what the viewer keeps.
                  let ended = false;
                  await saveSchool(
                    () => revoke({ grantId: grant.id, slug }),
                    SOURCE,
                    own
                      ? () => {
                          ended = true;
                          toast.success({
                            title: "school-own-role-ended.title",
                          });
                        }
                      : undefined
                  );
                  if (ended) {
                    await router.invalidate();
                    await navigate({
                      params: { slug },
                      replace: true,
                      to: "/school/$slug",
                    });
                  }
                });
              }}
              type="button"
              variant="destructive"
            >
              {t("grant-revoke-confirm")}
            </Button>
          </>
        }
        open={dialogs.isOpen("revoke")}
        setOpen={dialogs.setOpen}
        title={t("grant-revoke-title")}
      />
    </>
  );
}
