import {
  type PaginatedQueryItem,
  QueryResult,
  useMutation,
} from "@confect/react";
import { Delete02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { startTransition, useState } from "react";
import { useTranslations } from "use-intl";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { RoleBadge } from "@/components/tenant/role";
import { roleIcon } from "@/components/tenant/roles";
import { revokeGrantChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { scopeNameOf, scopeOptions } from "@/components/tenant/settings/scope";
import { isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/roles/grants";

/** One active grant of the school as the grants list shows it. */
type GrantItem = PaginatedQueryItem<typeof access.grants.list>;

/** The columns of the grants table. */
const grantColumns = createColumnHelper<typeof dataTableFeatures, GrantItem>();

/**
 * The grants in a data table that finds a person, filters by role and by what a grant covers in
 * those columns, and gives each revocable grant its menu, or the table's empty state when no one
 * holds a role.
 */
export function SchoolGrantTable({ grants }: { grants: readonly GrantItem[] }) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const viewer = useViewerQuery();

  if (Arr.isReadonlyArrayEmpty(grants)) {
    return (
      <TableEmpty
        act="juggling"
        description={t("roles-grants-description")}
        title={t("roles-empty")}
      />
    );
  }

  /** What a grant covers, by name: the whole school or one unit. */
  const scopeName = (grant: GrantItem) =>
    QueryResult.isSuccess(viewer)
      ? scopeNameOf(grant.scope, viewer.value.tenant.name, viewer.value.units)
      : "";
  const columns = grantColumns.columns([
    grantColumns.accessor((grant) => grant.person.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("grant-person"),
      id: "person",
      sortFn: "text",
    }),
    grantColumns.accessor((grant) => grant.role.key, {
      cell: (info) => <RoleBadge role={info.getValue()} />,
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="role"
          options={Arr.map(BuiltinRole.literals, (role) => ({
            icon: roleIcon(role),
            label: tSchool(`role.${role}`),
            value: role,
          }))}
          title={t("grant-role")}
        />
      ),
      id: "role",
      meta: { align: "center" },
    }),
    grantColumns.accessor(scopeName, {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="scope"
          options={
            QueryResult.isSuccess(viewer)
              ? scopeOptions(viewer.value.tenant.name, viewer.value.units)
              : []
          }
          title={t("grant-scope")}
        />
      ),
      id: "scope",
    }),
    grantColumns.display({
      cell: (info) =>
        info.row.original.revocable ? (
          <SchoolGrantMenu grant={info.row.original} />
        ) : null,
      id: "actions",
      meta: { align: "end" },
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={grants}
      rowId={(grant) => grant.id}
      search="person"
    />
  );
}

/**
 * A grant's row menu, which revokes the grant behind a confirmation. A draft grant, still
 * on its way to the server, has an inert menu. Revoking the viewer's own grant may end the
 * role that opens the settings, so the page first leaves for the school's home and the
 * revoke follows there with one sentence: the settings page never turns into a refusal
 * under the viewer.
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
  const [isRevoking, setIsRevoking] = useState(false);
  const own =
    QueryResult.isSuccess(viewer) && viewer.value.person.id === grant.person.id;

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(grant.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => setIsRevoking(true)}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {t("grant-revoke")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("grant-revoke-description")}
        footer={
          <>
            <Button
              onClick={() => setIsRevoking(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setIsRevoking(false);
                startTransition(async () => {
                  if (own) {
                    await navigate({
                      params: { slug },
                      replace: true,
                      to: "/school/$slug",
                    });
                  }
                  await saveSchool(
                    () => revoke({ grantId: grant.id, slug }),
                    SOURCE,
                    own
                      ? () =>
                          toast.success({
                            title: "school-own-role-ended.title",
                          })
                      : undefined
                  );
                });
              }}
              type="button"
              variant="destructive"
            >
              {t("grant-revoke-confirm")}
            </Button>
          </>
        }
        open={isRevoking}
        setOpen={setIsRevoking}
        title={t("grant-revoke-title")}
      />
    </div>
  );
}
