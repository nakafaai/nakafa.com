"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { BookOpen01Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import access from "@repo/backend/confect/_generated/refs/access";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
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
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import {
  assignGrantChange,
  revokeGrantChange,
} from "@/components/tenant/settings/mutation.client";
import { SettingsPage } from "@/components/tenant/settings/page";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { scopeNameOf } from "@/components/tenant/settings/scope";
import { isDraft } from "@/components/tenant/settings/state";

const SOURCE = "components/tenant/settings/roles";

/** How many grants one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One active grant of the school as the grants list shows it. */
type GrantItem = PaginatedQueryItem<typeof access.grants.list>;

/**
 * The roles of the school: Role guide in the header opens what each role may do, and
 * Give role opens the dialog that gives a role of the whole school to a person. The
 * grants sit in a data table, and each grant's revoke action sits in its row menu.
 */
export function SchoolRolesSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [isGuiding, setIsGuiding] = useState(false);
  const [isGiving, setIsGiving] = useState(false);

  return (
    <SettingsPage
      actions={
        <>
          {/* On a phone the guide keeps its icon, so the page's name keeps its room. */}
          <Button
            onClick={() => setIsGuiding(true)}
            type="button"
            variant="outline"
          >
            <HugeIcons icon={BookOpen01Icon} />
            <span className="max-sm:sr-only">{t("roles-guide")}</span>
          </Button>
          <Button onClick={() => setIsGiving(true)} type="button">
            {t("roles-assign")}
          </Button>
        </>
      }
    >
      <ReadBoundary>
        <SchoolGrantsBody slug={slug} />
      </ReadBoundary>
      <SchoolRoleGuide open={isGuiding} setOpen={setIsGuiding} />
      <SchoolGrantDialog open={isGiving} setOpen={setIsGiving} slug={slug} />
    </SettingsPage>
  );
}

/** The grants of the school, read a page at a time, with the table and its end. */
function SchoolGrantsBody({ slug }: { slug: TenantSlug }) {
  const pagination = usePaginatedQuery(
    access.grants.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <>
      {pagination._tag === "LoadingFirstPage" ? null : (
        <SchoolGrantTable grants={pagination.results} slug={slug} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The columns of the grants table. */
const grantColumns = createColumnHelper<typeof dataTableFeatures, GrantItem>();

/**
 * The grants in a data table that finds a person and filters by role and by what a grant
 * covers, or the table's empty state when no one holds a role.
 */
function SchoolGrantTable({
  grants,
  slug,
}: {
  grants: readonly GrantItem[];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const viewer = useQuery(tenancy.viewer.get, { slug });

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

/**
 * The sheet that says what each built-in role may do: a header, each role's badge above
 * its description, and a footer with its one sentence and Close, each set off by a line.
 */
function SchoolRoleGuide({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("roles-overview")}</SheetTitle>
          <SheetDescription>{t("roles-overview-description")}</SheetDescription>
        </SheetHeader>
        <ul className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
          {Arr.map(BuiltinRole.literals, (role) => (
            <li className="flex flex-col items-start gap-1.5" key={role}>
              <RoleBadge role={role} />
              <p className="text-muted-foreground text-sm">
                {t(`role-description.${role}`)}
              </p>
            </li>
          ))}
        </ul>
        <SheetFooter className="flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            {t("roles-overview-footer")}
          </p>
          <SheetClose
            render={
              <Button className="shrink-0" type="button" variant="outline">
                {common("close")}
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The dialog that gives a role of the whole school to a chosen person. The request
 * goes out first, and the dialog closes at once, so the grant shows in the table.
 */
function SchoolGrantDialog({
  open,
  setOpen,
  slug,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const common = useTranslations("Common");
  const id = useId();
  const assign = useMutation(access.grants.assign).withOptimisticUpdate(
    assignGrantChange
  );
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);
  const [role, setRole] = useState<BuiltinRole | undefined>(undefined);

  const roleItems = Arr.map(BuiltinRole.literals, (value) => ({
    label: tSchool(`role.${value}`),
    value,
  }));

  return (
    <ResponsiveDialog
      description={t("roles-assign-description")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={personId === undefined || role === undefined}
            onClick={() => {
              if (personId === undefined || role === undefined) {
                return;
              }
              startTransition(() =>
                saveSchool(
                  () =>
                    assign({
                      personId,
                      role,
                      scope: { kind: "tenant" },
                      slug,
                    }),
                  SOURCE
                )
              );
              setOpen(false);
            }}
            type="button"
          >
            {t("roles-assign")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("roles-assign-dialog")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-person`}>{t("grant-person")}</FieldLabel>
          <SchoolPersonPicker
            id={`${id}-person`}
            onChoose={setPersonId}
            personId={personId}
            slug={slug}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-role`}>{t("grant-role")}</FieldLabel>
          <Select
            items={roleItems}
            onValueChange={(value) => {
              const chosen = Schema.decodeUnknownOption(BuiltinRole)(value);
              if (Option.isSome(chosen)) {
                setRole(chosen.value);
              }
            }}
            value={role}
          >
            <SelectTrigger className="w-full" id={`${id}-role`}>
              <SelectValue placeholder={t("roles-role-placeholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Arr.map(roleItems, (item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
