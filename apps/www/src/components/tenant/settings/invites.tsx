import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  ClockAlertIcon,
  Delete02Icon,
  IdIcon,
  MailSend01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
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
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import { SchoolInviteAction } from "@/components/tenant/settings/invite";
import { SchoolIssueCardDialog } from "@/components/tenant/settings/issue";
import { revokeInviteChange } from "@/components/tenant/settings/mutation";
import { cardOffered } from "@/components/tenant/settings/offer";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { isDraft } from "@/components/tenant/settings/state";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/invites";

/** How many invites one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One pending invite as the invites list shows it. */
type InviteItem = PaginatedQueryItem<typeof tenancy.invites.list>;

/** The columns of the invites table. */
const inviteColumns = createColumnHelper<
  typeof dataTableFeatures,
  InviteItem
>();

/**
 * The invites of the school: Invite in the header, then every pending and expired invite in a
 * data table with its role, its expiry and its row menu. A pending invite sends again or
 * revokes; an expired one stays listed as expired and is sent again as a new invite. With no
 * invite, the table says what it will hold. The list loads more rows as its end comes into view.
 */
export function SchoolInvitesSettings() {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("invites-search")} />
            <SchoolInviteAction />
          </>
        }
      >
        <ReadBoundary>
          <SchoolInvitesBody />
        </ReadBoundary>
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The invites of the school, read a page at a time, with the table and its end. */
function SchoolInvitesBody() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    tenancy.invites.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {pagination._tag === "LoadingFirstPage" ||
      (failed && Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
        <SchoolInviteTable invites={pagination.results} />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The invites in a data table, or the table's empty state when there is none. */
function SchoolInviteTable({ invites }: { invites: readonly InviteItem[] }) {
  const t = useTranslations("SchoolSettings");

  if (Arr.isReadonlyArrayEmpty(invites)) {
    return (
      <TableEmpty
        act="waving"
        description={t("invites-footer")}
        title={t("invites-empty")}
      />
    );
  }

  const columns = inviteColumns.columns([
    inviteColumns.accessor((invite) => invite.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("invite-name"),
      id: "name",
      sortFn: "text",
    }),
    inviteColumns.accessor((invite) => invite.email, {
      filterFn: "includesString",
      header: t("invite-email"),
      id: "email",
      sortFn: "text",
    }),
    inviteColumns.display({
      cell: (info) => (
        <div className="inline-flex flex-wrap justify-center gap-1">
          {Arr.map(info.row.original.roles, (role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      ),
      header: t("invite-role"),
      id: "role",
      meta: { align: "center" },
    }),
    inviteColumns.accessor((invite) => invite.expiresAt, {
      cell: (info) =>
        info.row.original.status === "expired" ? (
          <TableStatus
            icon={ClockAlertIcon}
            label={t("invite-expired")}
            tone="warning"
          />
        ) : (
          <SchoolDateTime at={info.getValue()} />
        ),
      header: t("invite-expires"),
      id: "expires",
      sortFn: "basic",
    }),
    inviteColumns.display({
      cell: (info) => <SchoolInviteMenu invite={info.row.original} />,
      id: "actions",
      meta: { align: "end" },
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={invites}
      rowId={(invite) => invite.id}
      search="name"
    />
  );
}

/**
 * An invite's row menu. A pending invite is sent again in the viewer's language or revoked
 * behind a confirmation, and a login card is offered only to a Person who may take one (an
 * Owner or an Admin may not). An expired invite is sent again as a new invite to the same
 * Person and address, because the school never sends an expired invite itself. A draft invite,
 * still on its way to the server, has an inert menu, and a send waits until the viewer's
 * language is known.
 */
function SchoolInviteMenu({ invite }: { invite: InviteItem }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const sendLocale = Option.getOrUndefined(
    Schema.decodeOption(ActiveAppLocaleCodeSchema)(useLocale())
  );
  const resend = useMutation(tenancy.invites.resend);
  const inviteAgain = useMutation(tenancy.invites.invite);
  const revoke = useMutation(tenancy.invites.revoke).withOptimisticUpdate(
    revokeInviteChange
  );
  const [isRevoking, setIsRevoking] = useState(false);
  const [isResending, startResending] = useTransition();
  const [isIssuing, setIsIssuing] = useState(false);
  const [issued, setIssued] = useState<CardView | undefined>(undefined);
  const isExpired = invite.status === "expired";

  /**
   * Sends a pending invite again, in the viewer's language. Resend stays off until the send
   * settles, so a second press sends no second invite.
   */
  const sendPending = (locale: typeof ActiveAppLocaleCodeSchema.Type) =>
    startResending(() =>
      saveSchool(() => resend({ inviteId: invite.id, locale, slug }), SOURCE)
    );

  /**
   * Sends an expired invite's address again, as a new invite to the same Person. Resend stays
   * off until the send settles, so a second press sends no second invite.
   */
  const sendExpired = (locale: typeof ActiveAppLocaleCodeSchema.Type) =>
    startResending(() =>
      saveSchool(
        () =>
          inviteAgain({
            email: invite.email,
            locale,
            personId: invite.personId,
            slug,
          }),
        SOURCE
      )
    );

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(invite.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            disabled={sendLocale === undefined || isResending}
            onClick={() => {
              if (sendLocale !== undefined) {
                (isExpired ? sendExpired : sendPending)(sendLocale);
              }
            }}
          >
            <HugeIcons icon={MailSend01Icon} />
            {t("invite-resend")}
          </DropdownMenuItem>
          {isExpired ? null : (
            <>
              {cardOffered(invite.roles) ? (
                <DropdownMenuItem onClick={() => setIsIssuing(true)}>
                  <HugeIcons icon={IdIcon} />
                  {t("invite-card")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsRevoking(true)}
                variant="destructive"
              >
                <HugeIcons icon={Delete02Icon} />
                {t("invite-revoke")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("invite-revoke-description")}
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
                    () => revoke({ inviteId: invite.id, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
              variant="destructive"
            >
              {t("invite-revoke-confirm")}
            </Button>
          </>
        }
        open={isRevoking}
        setOpen={setIsRevoking}
        title={t("invite-revoke-title")}
      />
      <SchoolIssueCardDialog
        name={invite.name}
        onIssued={setIssued}
        open={isIssuing}
        personId={invite.personId}
        setOpen={setIsIssuing}
        slug={slug}
      />
      <SchoolCardDialog card={issued} onClose={() => setIssued(undefined)} />
    </div>
  );
}
