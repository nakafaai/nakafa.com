import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Delete02Icon,
  Key01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Plug01Icon,
  TaskDaily01Icon,
  Unlink01Icon,
} from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
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
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { createContext, use, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolDeliverySheet } from "@/components/tenant/settings/deliveries";
import { revokeWebhookChange } from "@/components/tenant/settings/mutation";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import {
  SchoolWebhookCreateDialog,
  SchoolWebhookEditDialog,
} from "@/components/tenant/settings/webhook";

const SOURCE = "components/tenant/settings/webhooks";

/** How many webhooks one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The look of each webhook status, in its cell and in its column's filter. */
const WEBHOOK_STATUS_LOOKS = {
  active: { icon: Plug01Icon, tone: "success" },
  revoked: { icon: Unlink01Icon, tone: "neutral" },
} as const satisfies Record<typeof IntegrationStatus.Type, StatusLook>;

/** One webhook as the list shows it. */
type WebhookItem = PaginatedQueryItem<typeof integrations.webhooks.list>;

/** The columns of the webhooks table. */
const webhookColumns = createColumnHelper<
  typeof dataTableFeatures,
  WebhookItem
>();

/** Shows a secret the server issued once, which the page's secret dialog holds. */
const SecretIssueContext = createContext<((secret: string) => void) | null>(
  null
);

/** Reads what shows an issued secret. It throws outside the page, which always provides it. */
function useIssueSecret() {
  const issue = use(SecretIssueContext);
  if (issue === null) {
    throw new Error(
      "useIssueSecret must be used within SchoolWebhooksSettings"
    );
  }
  return issue;
}

/**
 * The webhooks of the school in a data table with Create webhook in the header. A webhook
 * tells another system when something changes: it belongs to one client, and its secret is
 * shown once.
 */
export function SchoolWebhooksSettings() {
  const t = useTranslations("SchoolSettings");
  const [issuedSecret, setIssuedSecret] = useState<string | undefined>(
    undefined
  );
  const [isCreating, setIsCreating] = useState(false);

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("webhooks-search")} />
            <SchoolHeaderAdd
              label={t("webhook-add")}
              onClick={() => setIsCreating(true)}
            />
          </>
        }
      >
        <ReadBoundary>
          <SecretIssueContext value={setIssuedSecret}>
            <SchoolWebhookTable />
          </SecretIssueContext>
        </ReadBoundary>
        <SchoolWebhookCreateDialog
          onIssued={setIssuedSecret}
          open={isCreating}
          setOpen={setIsCreating}
        />
        <SchoolSecretDialog
          description={t("webhook-secret-description")}
          onClose={() => setIssuedSecret(undefined)}
          secret={issuedSecret}
          title={t("webhook-secret-title")}
        />
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The webhooks of the school, loading more as the end of the table comes into view. */
function SchoolWebhookTable() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    integrations.webhooks.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

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
        description={t("webhook-add-description")}
        title={t("webhooks-empty")}
      />
    );
  }

  const columns = webhookColumns.columns([
    webhookColumns.accessor((webhook) => webhook.url, {
      cell: (info) => (
        <span className="font-medium" dir="ltr">
          {info.getValue()}
        </span>
      ),
      filterFn: "includesString",
      header: t("webhook-url"),
      id: "url",
      sortFn: "text",
    }),
    webhookColumns.accessor((webhook) => webhook.clientName, {
      header: t("webhook-client"),
      id: "client",
      sortFn: "text",
    }),
    webhookColumns.accessor((webhook) => webhook.changes.length, {
      header: t("webhook-changes"),
      id: "changes",
      meta: { align: "end" },
    }),
    webhookColumns.accessor((webhook) => webhook.status, {
      cell: (info) => (
        <TableStatus
          icon={WEBHOOK_STATUS_LOOKS[info.getValue()].icon}
          label={t(`client-${info.getValue()}`)}
          tone={WEBHOOK_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(IntegrationStatus.literals, (status) => ({
            icon: WEBHOOK_STATUS_LOOKS[status].icon,
            label: t(`client-${status}`),
            value: status,
          }))}
          title={t("client-status")}
        />
      ),
      id: "status",
    }),
    webhookColumns.display({
      cell: (info) => <SchoolWebhookMenu webhook={info.row.original} />,
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        rowId={(webhook) => webhook.id}
        search="url"
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * A webhook's row menu: its delivery log, and for an active webhook the edit, a new secret,
 * and revoking behind a confirmation.
 */
function SchoolWebhookMenu({ webhook }: { webhook: WebhookItem }) {
  const { slug } = useTenant();
  const issueSecret = useIssueSecret();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const rotate = useMutation(integrations.webhooks.rotate);
  const revoke = useMutation(integrations.webhooks.revoke).withOptimisticUpdate(
    revokeWebhookChange
  );
  const [isPending, startTransition] = useTransition();
  const [isRevoking, setIsRevoking] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const names = {
    clientId: webhook.clientId,
    slug,
    webhookId: webhook.id,
  };

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
          <DropdownMenuItem onClick={() => setIsReading(true)}>
            <HugeIcons icon={TaskDaily01Icon} />
            {t("webhook-deliveries")}
          </DropdownMenuItem>
          {webhook.status === "active" ? (
            <>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <HugeIcons icon={PencilEdit02Icon} />
                {t("webhook-edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isPending}
                onClick={() =>
                  startTransition(() =>
                    saveSchool(
                      () => rotate(names),
                      SOURCE,
                      (issued) => issueSecret(issued.secret)
                    )
                  )
                }
              >
                <HugeIcons icon={Key01Icon} />
                {t("client-rotate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsRevoking(true)}
                variant="destructive"
              >
                <HugeIcons icon={Delete02Icon} />
                {t("client-revoke")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("webhook-revoke-description")}
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
                startTransition(() => saveSchool(() => revoke(names), SOURCE));
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
        title={t("webhook-revoke-title")}
      />
      <SchoolDeliverySheet
        open={isReading}
        setOpen={setIsReading}
        webhook={webhook}
      />
      {isEditing ? (
        <SchoolWebhookEditDialog
          open
          setOpen={setIsEditing}
          webhook={webhook}
        />
      ) : null}
    </div>
  );
}
