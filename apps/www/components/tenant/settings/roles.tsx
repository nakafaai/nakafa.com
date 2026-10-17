"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import access from "@repo/backend/confect/_generated/refs/access";
import { BuiltinRole } from "@repo/backend/confect/access/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
  TableHead,
  TableHeader,
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
import type { PersonId } from "@/components/tenant/settings/people";
import { SchoolPersonCard } from "@/components/tenant/settings/person";
import { saveSchool } from "@/components/tenant/settings/save.client";

const SOURCE = "components/tenant/settings/roles";

/** The ID of one grant of a person. */
type GrantId = Ref.Returns<typeof access.grants.list>[number]["id"];

/**
 * Renders the roles of the school: the person whose access is shown, that person's
 * grants, and the form that gives a role to them. A role covers the whole school.
 */
export function SchoolRolesSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [personId, setPersonId] = useState<PersonId | undefined>(undefined);

  return (
    <>
      <SchoolPersonCard
        description={t("roles-description")}
        onChoose={setPersonId}
        personId={personId}
        slug={slug}
        title={t("roles")}
      />
      {personId === undefined ? null : (
        <SchoolGrantsCard personId={personId} slug={slug} />
      )}
    </>
  );
}

/** Renders one grant row, with its revoke action behind a confirmation. */
function SchoolGrantRow({
  grant,
  slug,
}: {
  grant: {
    readonly id: GrantId;
    readonly role: { readonly key: BuiltinRole };
    readonly scope: { readonly kind: "tenant" | "unit" };
  };
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const revoke = useMutation(access.grants.revoke);
  const [isRevoking, setIsRevoking] = useState(false);

  return (
    <TableRow>
      <TableCell>{tSchool(`role.${grant.role.key}`)}</TableCell>
      <TableCell>
        {grant.scope.kind === "tenant"
          ? t("grant-scope-school")
          : t("grant-scope-unit")}
      </TableCell>
      <TableCell className="text-right">
        <Button
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

/** Renders the grants of one person, with the form that gives a role to that person. */
function SchoolGrantsCard({
  personId,
  slug,
}: {
  personId: PersonId;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tSchool = useTranslations("School");
  const grants = useQuery(access.grants.list, { personId, slug });
  const assign = useMutation(access.grants.assign);
  const [role, setRole] = useState<BuiltinRole | undefined>(undefined);

  if (!QueryResult.isSuccess(grants)) {
    return null;
  }

  const roleItems = Arr.map(BuiltinRole.literals, (value) => ({
    label: tSchool(`role.${value}`),
    value,
  }));

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("roles-grants")}</CardTitle>
        <CardDescription>{t("roles-grants-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("grant-role")}</TableHead>
              <TableHead>{t("grant-scope")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(grants.value, (grant) => (
              <SchoolGrantRow grant={grant} key={grant.id} slug={slug} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
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
