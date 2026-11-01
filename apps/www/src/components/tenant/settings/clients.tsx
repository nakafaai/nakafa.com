import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  CommandLineIcon,
  Copy01Icon,
  Delete02Icon,
  Key01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Plug01Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import type { IssuedClient } from "@repo/backend/confect/integrations/clients.spec";
import { IntegrationStatus } from "@repo/backend/confect/integrations/schema";
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
import { Array as Arr } from "effect";
import { createContext, use, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useDialogs } from "@/components/shared/dialogs";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  SchoolClientCreateDialog,
  SchoolClientEditDialog,
} from "@/components/tenant/settings/client";
import { SchoolDeviceDialog } from "@/components/tenant/settings/device";
import { revokeClientChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { scopeNameOf, scopeOptions } from "@/components/tenant/settings/scope";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SettingsTablePage } from "@/components/tenant/settings/section";

/**
 * The look of each client status, in its table cell and in its column's filter: a plugged-in client,
 * and an unlinked one, each in its tone.
 */
const CLIENT_STATUS_LOOKS = {
  active: { icon: Plug01Icon, tone: "success" },
  revoked: { icon: Unlink01Icon, tone: "neutral" },
} as const satisfies Record<typeof IntegrationStatus.Type, StatusLook>;

const SOURCE = "components/tenant/settings/clients";

/** How many clients one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One integration client as the clients list shows it. */
type ClientItem = PaginatedQueryItem<typeof integrations.clients.list>;

/** The columns of the clients table. */
const clientColumns = tableColumns<ClientItem>();

/** Shows a secret the server issued once, which the page's secret dialog holds. */
const SecretIssueContext = createContext<
  ((issued: typeof IssuedClient.Type) => void) | null
>(null);

/** Reads what shows an issued secret. It throws outside the clients page, which always provides it. */
function useIssueSecret() {
  const issue = use(SecretIssueContext);
  if (issue === null) {
    throw new Error("useIssueSecret must be used within SchoolClientsSettings");
  }
  return issue;
}

/**
 * Renders the integration clients of the school, each with the part of the school it
 * covers, in a data table with Create client in the header. A client is created, rotated
 * (which issues a new secret that is shown once), or revoked.
 */
export function SchoolClientsSettings() {
  const t = useTranslations("SchoolSettings");
  const [issued, setIssued] = useState<typeof IssuedClient.Type | undefined>(
    undefined
  );
  const [isCreating, setIsCreating] = useState(false);

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("clients-search")} />
            <SchoolHeaderAdd
              label={t("client-add")}
              onClick={() => setIsCreating(true)}
            />
          </>
        }
      >
        <ReadBoundary>
          <SecretIssueContext value={setIssued}>
            <SchoolClientTable />
          </SecretIssueContext>
        </ReadBoundary>
        <SchoolClientCreateDialog
          onIssued={setIssued}
          open={isCreating}
          setOpen={setIsCreating}
        />
        <SchoolSecretDialog
          description={t("client-secret-description")}
          identifier={issued?.id}
          onClose={() => setIssued(undefined)}
          secret={issued?.secret}
          title={t("client-secret-title")}
        />
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/**
 * Renders the clients of the school in a data table that filters by name, scope, and
 * status, and loads more rows as its end comes into view, or the table's empty state while
 * the school has no client. The table waits for its first page, so no empty state shows
 * before the rows arrive.
 */
function SchoolClientTable() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    integrations.clients.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const viewer = useViewerQuery();

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <LoadFailure onRetry={reloadPage} />;
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
  const columns = [
    clientColumns.text((client) => client.name, {
      cell: (info) => (
        <TableTitle icon={Key01Icon}>{info.getValue()}</TableTitle>
      ),
      header: t("client-name"),
      id: "name",
    }),
    clientColumns.values(scopeName, {
      header: t("client-scope"),
      id: "scope",
      options: QueryResult.isSuccess(viewer)
        ? scopeOptions(viewer.value.tenant.name, viewer.value.units)
        : [],
    }),
    clientColumns.values((client) => client.status, {
      cell: (info) => (
        <TableStatus
          icon={CLIENT_STATUS_LOOKS[info.getValue()].icon}
          label={t(`client-${info.getValue()}`)}
          tone={CLIENT_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("client-status"),
      id: "status",
      options: Arr.map(IntegrationStatus.literals, (status) => ({
        icon: CLIENT_STATUS_LOOKS[status].icon,
        label: t(`client-${status}`),
        value: status,
      })),
    }),
    clientColumns.menu((info) =>
      info.row.original.status === "active" ? (
        <SchoolClientMenu client={info.row.original} />
      ) : null
    ),
  ];

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        rowId={(client) => client.id}
        search="name"
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
function SchoolClientMenu({ client }: { client: ClientItem }) {
  const { slug } = useTenant();
  const issueSecret = useIssueSecret();
  const clipboard = useClipboard({ timeout: 1500 });
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const rotate = useMutation(integrations.clients.rotate);
  const revoke = useMutation(integrations.clients.revoke).withOptimisticUpdate(
    revokeClientChange
  );
  const [isPending, startTransition] = useTransition();
  const dialogs = useDialogs<"connect" | "edit" | "revoke">();

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
          <DropdownMenuItem onClick={() => dialogs.show("edit")}>
            <HugeIcons icon={PencilEdit02Icon} />
            {t("client-edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isPending}
            onClick={() =>
              startTransition(() =>
                saveSchool(
                  () => rotate({ clientId: client.id, slug }),
                  SOURCE,
                  (answer) => issueSecret(answer)
                )
              )
            }
          >
            <HugeIcons icon={Key01Icon} />
            {t("client-rotate")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => clipboard.copy(client.id)}>
            <HugeIcons icon={Copy01Icon} />
            {t("client-id-copy")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => dialogs.show("connect")}>
            <HugeIcons icon={CommandLineIcon} />
            {t("device-title")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => dialogs.show("revoke")}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {t("client-revoke")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("client-revoke-description")}
        footer={
          <>
            <Button onClick={dialogs.close} type="button" variant="outline">
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                dialogs.close();
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
        open={dialogs.isOpen("revoke")}
        setOpen={dialogs.setOpen}
        title={t("client-revoke-title")}
      />
      {dialogs.kind === "edit" ? (
        <SchoolClientEditDialog
          client={client}
          key={dialogs.key}
          open={dialogs.isOpen("edit")}
          setOpen={dialogs.setOpen}
        />
      ) : null}
      <SchoolDeviceDialog
        client={client}
        open={dialogs.isOpen("connect")}
        setOpen={dialogs.setOpen}
        slug={slug}
      />
    </div>
  );
}
