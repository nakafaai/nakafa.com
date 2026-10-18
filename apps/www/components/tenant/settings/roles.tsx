"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import access from "@repo/backend/confect/_generated/refs/access";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import {
  assignGrantChange,
  revokeGrantChange,
} from "@/components/tenant/settings/mutation.client";
import type { PersonId } from "@/components/tenant/settings/people";
import { SchoolPersonCard } from "@/components/tenant/settings/person";
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
 * Renders the roles of the school: what each role may do, every role the school
 * holds with its person, and the form that gives a role of the whole school to a
 * chosen person.
 */
export function SchoolRolesSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);

  return (
    <>
      <SchoolRolesOverview />
      <SchoolGrantsCard slug={slug} />
      <SchoolPersonCard
        description={t("roles-description")}
        onChoose={setPersonId}
        personId={personId}
        slug={slug}
        title={t("roles")}
      />
      {personId === undefined ? null : (
        <SchoolAssignCard personId={personId} slug={slug} />
      )}
    </>
  );
}

/** Renders every role of the school, each under its name, with what the role may do. */
function SchoolRolesOverview() {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("roles-overview")}</CardTitle>
        <CardDescription>{t("roles-overview-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {Arr.map(BuiltinRole.literals, (role) => (
              <TableRow key={role}>
                <TableCell>
                  <p className="font-medium">{tSchool(`role.${role}`)}</p>
                  <p className="text-muted-foreground text-sm">
                    {t(`role-description.${role}`)}
                  </p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </CardSection>
  );
}

/**
 * Renders the active roles of the school, a page at a time: the Person who holds
 * each role, the role, and what it covers. The list loads more rows as its end
 * comes into view.
 */
function SchoolGrantsCard({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    access.grants.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("roles-grants")}</CardTitle>
        <CardDescription>{t("roles-grants-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <SchoolTableHeader
            columns={[t("grant-person"), t("grant-role"), t("grant-scope"), ""]}
          />
          <TableBody>
            {Arr.map(pagination.results, (grant) => (
              <SchoolGrantRow grant={grant} key={grant.id} slug={slug} />
            ))}
          </TableBody>
        </Table>
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </CardContent>
    </CardSection>
  );
}

/**
 * Renders one grant row: its person, its role, what it covers, and its revoke action
 * behind a confirmation. A grant the page is still giving waits, so its revoke is inert.
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
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const revoke = useMutation(access.grants.revoke).withOptimisticUpdate(
    revokeGrantChange
  );
  const [isRevoking, setIsRevoking] = useState(false);

  return (
    <TableRow>
      <TableCell>{grant.person.name}</TableCell>
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
        <Button
          inert={isDraft(grant.id)}
          onClick={() => setIsRevoking(true)}
          size="sm"
          type="button"
          variant="destructive"
        >
          {t("grant-revoke")}
        </Button>
        <ResponsiveDialog
          description={t("grant-revoke-description")}
          footer={
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
          }
          open={isRevoking}
          setOpen={setIsRevoking}
          title={t("grant-revoke-title")}
        />
      </TableCell>
    </TableRow>
  );
}

/** Renders the form that gives a role of the whole school to the chosen person. */
function SchoolAssignCard({
  personId,
  slug,
}: {
  personId: PersonId;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const assign = useMutation(access.grants.assign).withOptimisticUpdate(
    assignGrantChange
  );
  const [role, setRole] = useState<BuiltinRole | undefined>(undefined);

  const roleItems = Arr.map(BuiltinRole.literals, (value) => ({
    label: tSchool(`role.${value}`),
    value,
  }));

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("roles-assign-title")}</CardTitle>
      </CardHeader>
      <CardSectionFooter>
        <CardSectionHint>{t("roles-assign-footer")}</CardSectionHint>
        <CardSectionActions>
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
            <SelectTrigger className="w-full max-w-xs">
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
          <Button
            disabled={role === undefined}
            onClick={() => {
              if (role !== undefined) {
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
              }
            }}
            size="sm"
            type="button"
          >
            {t("roles-assign")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
