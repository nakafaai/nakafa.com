import {
  type PaginatedQueryItem,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Delete02Icon,
  Key01Icon,
  PencilEdit02Icon,
  Plug01Icon,
  TaskDaily01Icon,
  Unlink01Icon,
  WebhookIcon,
} from "@hugeicons/core-free-icons";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
import { IntegrationStatus } from "@repo/backend/confect/integrations/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr } from "effect";
import { createContext, use, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useDialogs } from "@/components/shared/dialogs";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolDeliverySheet } from "@/components/tenant/settings/deliveries";
import { revokeWebhookChange } from "@/components/tenant/settings/mutation";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import {
  SchoolWebhookCreateDialog,
  SchoolWebhookEditDialog,
} from "@/components/tenant/settings/webhook";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

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
const webhookColumns = tableColumns<WebhookItem>();

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
  const tCommon = useTranslations("Common");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    integrations.webhooks.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const columns = [
    webhookColumns.text((webhook) => webhook.url, {
      cell: (info) => (
        <TableTitle icon={WebhookIcon}>
          <span dir="ltr">{info.getValue()}</span>
        </TableTitle>
      ),
      header: t("webhook-url"),
      id: "url",
    }),
    webhookColumns.text((webhook) => webhook.clientName, {
      header: t("webhook-client"),
      id: "client",
    }),
    webhookColumns.number((webhook) => webhook.changes.length, {
      align: "end",
      header: t("webhook-changes"),
      id: "changes",
    }),
    webhookColumns.values((webhook) => webhook.status, {
      cell: (info) => (
        <TableStatus
          icon={WEBHOOK_STATUS_LOOKS[info.getValue()].icon}
          label={t(`client.${info.getValue()}`)}
          tone={WEBHOOK_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: tCommon("state"),
      id: "status",
      options: Arr.map(IntegrationStatus.literals, (status) => ({
        icon: WEBHOOK_STATUS_LOOKS[status].icon,
        label: t(`client.${status}`),
        value: status,
      })),
    }),
    webhookColumns.menu((info) => (
      <SchoolWebhookMenu webhook={info.row.original} />
    )),
  ];

  return (
    <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
      <DataTable
        columns={columns}
        data={pagination.results}
        empty={
          <EmptyState
            description={t("webhook-add-description")}
            scene={<EmptyNina act="typing" />}
            title={t("webhooks-empty")}
          />
        }
        rowId={(webhook) => webhook.id}
        search="url"
      />
    </TablePages>
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
  const tCommon = useTranslations("Common");
  const rotate = useMutation(integrations.webhooks.rotate);
  const revoke = useMutation(integrations.webhooks.revoke).withOptimisticUpdate(
    revokeWebhookChange
  );
  const [isPending, startTransition] = useTransition();
  const dialogs = useDialogs<"edit" | "read" | "revoke">();
  const names = {
    clientId: webhook.clientId,
    slug,
    webhookId: webhook.id,
  };

  return (
    <>
      <RowItems>
        <DropdownMenuItem
          icon={TaskDaily01Icon}
          onClick={() => dialogs.show("read")}
        >
          {t("webhook-deliveries")}
        </DropdownMenuItem>
        {webhook.status === "active" ? (
          <>
            <DropdownMenuItem
              icon={PencilEdit02Icon}
              onClick={() => dialogs.show("edit")}
            >
              {tCommon("edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isPending}
              icon={Key01Icon}
              onClick={() =>
                startTransition(() =>
                  runSchoolWrite(
                    schoolCall(() => rotate(names)),
                    { onSaved: (issued) => issueSecret(issued.secret) }
                  )
                )
              }
            >
              {t("client-rotate")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={Delete02Icon}
              onClick={() => dialogs.show("revoke")}
              variant="destructive"
            >
              {t("grant-revoke")}
            </DropdownMenuItem>
          </>
        ) : null}
      </RowItems>
      <ResponsiveDialog
        action={
          <Button
            onClick={() => {
              dialogs.close();
              startTransition(() =>
                runSchoolWrite(schoolCall(() => revoke(names)))
              );
            }}
            type="button"
            variant="destructive"
          >
            {t("grant-revoke")}
          </Button>
        }
        description={t("webhook-revoke-description")}
        open={dialogs.isOpen("revoke")}
        setOpen={dialogs.setOpen}
        title={t("webhook-revoke-title")}
      >
        <ResponsiveDialogSubject icon={WebhookIcon}>
          {webhook.url}
        </ResponsiveDialogSubject>
      </ResponsiveDialog>
      <SchoolDeliverySheet
        open={dialogs.isOpen("read")}
        setOpen={dialogs.setOpen}
        webhook={webhook}
      />
      {dialogs.kind === "edit" ? (
        <SchoolWebhookEditDialog
          key={dialogs.key}
          open={dialogs.isOpen("edit")}
          setOpen={dialogs.setOpen}
          webhook={webhook}
        />
      ) : null}
    </>
  );
}
