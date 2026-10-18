"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
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
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
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
import { SchoolTableHeader } from "@/components/tenant/settings/table";

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
  const pagination = usePaginatedQuery(
    access.grants.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );
  const [isGuiding, setIsGuiding] = useState(false);
  const [isGiving, setIsGiving] = useState(false);

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <SettingsPage
      actions={
        <>
          <Button
            onClick={() => setIsGuiding(true)}
            type="button"
            variant="outline"
          >
            {t("roles-guide")}
          </Button>
          <Button onClick={() => setIsGiving(true)} type="button">
            {t("roles-assign")}
          </Button>
        </>
      }
    >
      {pagination._tag === "LoadingFirstPage" ? null : (
        <SchoolGrantTable grants={pagination.results} slug={slug} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
      <SchoolRoleGuide open={isGuiding} setOpen={setIsGuiding} />
      <SchoolGrantDialog open={isGiving} setOpen={setIsGiving} slug={slug} />
    </SettingsPage>
  );
}

/** The grants in a data table, or the table's empty state when no one holds a role. */
function SchoolGrantTable({
  grants,
  slug,
}: {
  grants: readonly GrantItem[];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");

  if (Arr.isReadonlyArrayEmpty(grants)) {
    return (
      <TableEmpty
        act="juggling"
        description={t("roles-grants-description")}
        title={t("roles-empty")}
      />
    );
  }

  return (
    <TableFrame>
      <Table>
        <SchoolTableHeader
          columns={[t("grant-person"), t("grant-role"), t("grant-scope"), ""]}
        />
        <TableBody>
          {Arr.map(grants, (grant) => (
            <SchoolGrantRow grant={grant} key={grant.id} slug={slug} />
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/**
 * One grant row: its person, its role, what it covers, and its row menu, which revokes
 * the grant behind a confirmation. A draft grant, still on its way to the server, has an
 * inert menu.
 */
function SchoolGrantRow({
  grant,
  slug,
}: {
  grant: GrantItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const common = useTranslations("Common");
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const revoke = useMutation(access.grants.revoke).withOptimisticUpdate(
    revokeGrantChange
  );
  const [isRevoking, setIsRevoking] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">{grant.person.name}</TableCell>
      <TableCell>{tSchool(`role.${grant.role.key}`)}</TableCell>
      <TableCell>
        {QueryResult.isSuccess(viewer)
          ? scopeNameOf(
              grant.scope,
              viewer.value.tenant.name,
              viewer.value.units
            )
          : ""}
      </TableCell>
      <TableCell className="text-right">
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
                    saveSchool(
                      () => revoke({ grantId: grant.id, slug }),
                      SOURCE
                    )
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
      </TableCell>
    </TableRow>
  );
}

/**
 * The sheet that says what each built-in role may do, with the name of each role
 * above its description.
 */
function SchoolRoleGuide({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("roles-overview")}</SheetTitle>
          <SheetDescription>{t("roles-overview-description")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          {Arr.map(BuiltinRole.literals, (role) => (
            <div className="grid gap-1" key={role}>
              <p className="font-medium text-sm">{tSchool(`role.${role}`)}</p>
              <p className="text-muted-foreground text-sm">
                {t(`role-description.${role}`)}
              </p>
            </div>
          ))}
          <p className="text-muted-foreground text-sm">
            {t("roles-overview-footer")}
          </p>
        </div>
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
