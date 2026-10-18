"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
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
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { SchoolClientCreateDialog } from "@/components/tenant/settings/client";
import { revokeClientChange } from "@/components/tenant/settings/mutation.client";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { scopeNameOf } from "@/components/tenant/settings/scope";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SchoolTableHeader } from "@/components/tenant/settings/table";

const SOURCE = "components/tenant/settings/clients";

/** How many clients one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One integration client as the clients list shows it. */
type ClientItem = PaginatedQueryItem<typeof integrations.clients.list>;

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolClientsSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <SchoolClientsBody slug={slug} />
    </SettingsPage>
  );
}

/**
 * Renders the integration clients of the school, each with the part of the school it
 * covers. A client is created, rotated (which issues a new secret that is shown once),
 * or revoked.
 */
function SchoolClientsBody({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [issuedSecret, setIssuedSecret] = useState<string | undefined>(
    undefined
  );
  const [isCreating, setIsCreating] = useState(false);
  const pagination = usePaginatedQuery(
    integrations.clients.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("clients")}</CardTitle>
        <CardDescription>{t("clients-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <SchoolTableHeader
            columns={[
              t("client-name"),
              t("client-scope"),
              t("client-status"),
              "",
            ]}
          />
          <TableBody>
            {Arr.map(pagination.results, (client) => (
              <SchoolClientRow
                client={client}
                key={client.id}
                onIssued={setIssuedSecret}
                slug={slug}
              />
            ))}
          </TableBody>
        </Table>
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("client-add-footer")}</CardSectionHint>
        <CardSectionActions>
          <Button onClick={() => setIsCreating(true)} size="sm" type="button">
            {t("client-add")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
      <SchoolClientCreateDialog
        onIssued={setIssuedSecret}
        open={isCreating}
        setOpen={setIsCreating}
        slug={slug}
      />
      <SchoolSecretDialog
        description={t("client-secret-description")}
        onClose={() => setIssuedSecret(undefined)}
        secret={issuedSecret}
        title={t("client-secret-title")}
      />
    </CardSection>
  );
}

/**
 * Renders one client row, with its rotate action and, while it is active, its revoke
 * action. The rotate button stays as it is while its request runs, and is inert then.
 */
function SchoolClientRow({
  client,
  onIssued,
  slug,
}: {
  client: ClientItem;
  onIssued: (secret: string) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const rotate = useMutation(integrations.clients.rotate);
  const revoke = useMutation(integrations.clients.revoke).withOptimisticUpdate(
    revokeClientChange
  );
  const [isPending, startTransition] = useTransition();
  const [isRevoking, setIsRevoking] = useState(false);
  const isActive = client.status === "active";

  return (
    <TableRow>
      <TableCell>{client.name}</TableCell>
      <TableCell>
        {QueryResult.isSuccess(viewer)
          ? scopeNameOf(
              client.scope,
              viewer.value.tenant.name,
              viewer.value.units
            )
          : ""}
      </TableCell>
      <TableCell>{t(`client-${client.status}`)}</TableCell>
      <TableCell className="text-right">
        {isActive ? (
          <>
            <Button
              inert={isPending}
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => rotate({ clientId: client.id, slug }),
                    SOURCE,
                    (issued) => onIssued(issued.secret)
                  )
                )
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t("client-rotate")}
            </Button>
            <Button
              onClick={() => setIsRevoking(true)}
              size="sm"
              type="button"
              variant="destructive"
            >
              {t("client-revoke")}
            </Button>
            <ResponsiveDialog
              description={t("client-revoke-description")}
              footer={
                <Button
                  onClick={() => {
                    setIsRevoking(false);
                    startTransition(() =>
                      saveSchool(
                        () => revoke({ clientId: client.id, slug }),
                        SOURCE
                      )
                    );
                  }}
                  type="button"
                  variant="destructive"
                >
                  {t("client-revoke-confirm")}
                </Button>
              }
              open={isRevoking}
              setOpen={setIsRevoking}
              title={t("client-revoke-title")}
            />
          </>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
