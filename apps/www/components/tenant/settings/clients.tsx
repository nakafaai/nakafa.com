"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { ApiIcon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
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

/**
 * Renders the integration clients of the school, each with the part of the school it
 * covers, in a data table with Create client in the header. A client is created, rotated
 * (which issues a new secret that is shown once), or revoked.
 */
export function SchoolClientsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [issuedSecret, setIssuedSecret] = useState<string | undefined>(
    undefined
  );
  const [isCreating, setIsCreating] = useState(false);

  return (
    <SettingsPage
      actions={
        <Button onClick={() => setIsCreating(true)} type="button">
          {t("client-add")}
        </Button>
      }
    >
      <SchoolClientTable onIssued={setIssuedSecret} slug={slug} />
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
    </SettingsPage>
  );
}

/**
 * Renders the clients of the school in a data table that loads more rows as its end comes
 * into view, or the table's empty state while the school has no client. The table waits
 * for its first page, so no empty state shows before the rows arrive.
 */
function SchoolClientTable({
  onIssued,
  slug,
}: {
  onIssued: (secret: string) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    integrations.clients.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <TableEmpty
        description={t("client-add-description")}
        icon={<HugeIcons icon={ApiIcon} />}
        title={t("clients-empty")}
      />
    );
  }

  return (
    <>
      <TableFrame>
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
                onIssued={onIssued}
                slug={slug}
              />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * Renders one client row: its name, the part of the school it covers, and its status.
 * An active client's row menu rotates its secret, which the rotate request answers once,
 * and revokes it behind a confirmation. A revoked client has no menu. The rotate item is
 * disabled while its request runs.
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
  const common = useTranslations("Common");
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
      <TableCell className="font-medium">{client.name}</TableCell>
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
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      saveSchool(
                        () => rotate({ clientId: client.id, slug }),
                        SOURCE,
                        (issued) => onIssued(issued.secret)
                      )
                    )
                  }
                >
                  {t("client-rotate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsRevoking(true)}
                  variant="destructive"
                >
                  {t("client-revoke")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ResponsiveDialog
              description={t("client-revoke-description")}
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
                </>
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
