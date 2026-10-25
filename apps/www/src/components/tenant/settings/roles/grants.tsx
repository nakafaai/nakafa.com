import {
  type PaginatedQueryItem,
  QueryResult,
  useMutation,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { startTransition, useState } from "react";
import { useTranslations } from "use-intl";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { useViewerQuery } from "@/components/tenant/context";
import { RoleBadge } from "@/components/tenant/role";
import { revokeGrantChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { scopeNameOf } from "@/components/tenant/settings/scope";
import { isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/roles/grants";

/** One active grant of the school as the grants list shows it. */
type GrantItem = PaginatedQueryItem<typeof access.grants.list>;

/** The columns of the grants table. */
const grantColumns = createColumnHelper<typeof dataTableFeatures, GrantItem>();

/**
 * The grants in a data table that finds a person and filters by role and by what a grant
 * covers, or the table's empty state when no one holds a role.
 */
export function SchoolGrantTable({
  grants,
  slug,
}: {
  grants: readonly GrantItem[];
  slug: TenantSlug;
}) {
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
      header: t("grant-role"),
      id: "role",
    }),
    grantColumns.accessor(scopeName, {
      filterFn: "oneOf",
      header: t("grant-scope"),
      id: "scope",
      sortFn: "text",
    }),
    grantColumns.display({
      cell: (info) => <SchoolGrantMenu grant={info.row.original} slug={slug} />,
      id: "actions",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={grants}
      facets={[
        {
          column: "role",
          options: Arr.map(BuiltinRole.literals, (role) => ({
            label: tSchool(`role.${role}`),
            value: role,
          })),
          title: t("grant-role"),
        },
        {
          column: "scope",
          options: Arr.map(
            Arr.dedupe(
              Arr.filter(Arr.map(grants, scopeName), (name) => name !== "")
            ),
            (name) => ({
              label: name,
              value: name,
            })
          ),
          title: t("grant-scope"),
        },
      ]}
      rowId={(grant) => grant.id}
      search={{ column: "person", placeholder: t("roles-search") }}
    />
  );
}

/**
 * A grant's row menu, which revokes the grant behind a confirmation. A draft grant, still
 * on its way to the server, has an inert menu.
 */
function SchoolGrantMenu({
  grant,
  slug,
}: {
  grant: GrantItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const revoke = useMutation(access.grants.revoke).withOptimisticUpdate(
    revokeGrantChange
  );
  const [isRevoking, setIsRevoking] = useState(false);

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
                startTransition(() =>
                  saveSchool(() => revoke({ grantId: grant.id, slug }), SOURCE)
                );
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
