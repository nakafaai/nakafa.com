"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import { IntegrationStatus } from "@repo/backend/confect/integrations/schema";
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
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { createContext, use, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolClientCreateDialog } from "@/components/tenant/settings/client";
import { revokeClientChange } from "@/components/tenant/settings/mutation.client";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { scopeNameOf } from "@/components/tenant/settings/scope";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";

const SOURCE = "components/tenant/settings/clients";

/** How many clients one page of the list loads, and each page after it. */
export const PAGE_SIZE = 25;

/** The first page of the list, which its loader read on the server. */
type ClientsFirstPage = PreloadedPage<
  PaginatedQueryItem<typeof integrations.clients.list>
>;

/** One integration client as the clients list shows it. */
type ClientItem = PaginatedQueryItem<typeof integrations.clients.list>;

/** The columns of the clients table. */
const clientColumns = createColumnHelper<
  typeof dataTableFeatures,
  ClientItem
>();

/** The first page of the clients, which the page's loader read on the server. */
const ClientsFirstPageContext = createContext<ClientsFirstPage | undefined>(
  undefined
);

/**
 * Renders the integration clients of the school, each with the part of the school it
 * covers, in a data table with Create client in the header. A client is created, rotated
 * (which issues a new secret that is shown once), or revoked.
 */
export function SchoolClientsSettings({
  first,
  slug,
}: {
  first: ClientsFirstPage | undefined;
  slug: TenantSlug;
}) {
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
      <ReadBoundary>
        <ClientsFirstPageContext value={first}>
          <SchoolClientTable onIssued={setIssuedSecret} slug={slug} />
        </ClientsFirstPageContext>
      </ReadBoundary>
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
 * Renders the clients of the school in a data table that filters by name, scope, and
 * status, and loads more rows as its end comes into view, or the table's empty state while
 * the school has no client. The table waits for its first page, so no empty state shows
 * before the rows arrive.
 */
function SchoolClientTable({
  onIssued,
  slug,
}: {
  onIssued: (secret: string) => void;
  slug: TenantSlug;
}) {
  const first = use(ClientsFirstPageContext);
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    integrations.clients.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE },
    first
  );
  const viewer = useViewerQuery();

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <DataFailure onRetry={reloadPage} />;
    }
    return (
      <TableEmpty
        act="typing"
        description={t("client-add-description")}
        title={t("clients-empty")}
      />
    );
  }

  /** What a client covers, by name: the whole school or one unit. */
  const scopeName = (client: ClientItem) =>
    QueryResult.isSuccess(viewer)
      ? scopeNameOf(client.scope, viewer.value.tenant.name, viewer.value.units)
      : "";
  const columns = clientColumns.columns([
    clientColumns.accessor((client) => client.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("client-name"),
      id: "name",
      sortFn: "text",
    }),
    clientColumns.accessor(scopeName, {
      filterFn: "oneOf",
      header: t("client-scope"),
      id: "scope",
      sortFn: "text",
    }),
    clientColumns.accessor((client) => client.status, {
      cell: (info) => t(`client-${info.getValue()}`),
      enableSorting: false,
      filterFn: "oneOf",
      header: t("client-status"),
      id: "status",
    }),
    clientColumns.display({
      cell: (info) =>
        info.row.original.status === "active" ? (
          <SchoolClientMenu
            client={info.row.original}
            onIssued={onIssued}
            slug={slug}
          />
        ) : null,
      id: "actions",
    }),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        facets={[
          {
            column: "scope",
            options: Arr.map(
              Arr.dedupe(
                Arr.filter(
                  Arr.map(pagination.results, scopeName),
                  (name) => name !== ""
                )
              ),
              (name) => ({ label: name, value: name })
            ),
            title: t("client-scope"),
          },
          {
            column: "status",
            options: Arr.map(IntegrationStatus.literals, (status) => ({
              label: t(`client-${status}`),
              value: status,
            })),
            title: t("client-status"),
          },
        ]}
        rowId={(client) => client.id}
        search={{ column: "name", placeholder: t("clients-search") }}
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * An active client's row menu. Rotating issues a new secret, which the rotate request
 * answers once, and revoking asks first behind a confirmation. The rotate item is disabled
 * while its request runs. A revoked client has no menu, so its cell stays empty.
 */
function SchoolClientMenu({
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
  const rotate = useMutation(integrations.clients.rotate);
  const revoke = useMutation(integrations.clients.revoke).withOptimisticUpdate(
    revokeClientChange
  );
  const [isPending, startTransition] = useTransition();
  const [isRevoking, setIsRevoking] = useState(false);

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
    </div>
  );
}
