"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
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
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { startTransition, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { RoleBadge } from "@/components/tenant/role";
import {
  type CardView,
  SchoolCardDialog,
} from "@/components/tenant/settings/card";
import { SchoolInviteDialog } from "@/components/tenant/settings/invite";
import { SchoolIssueCardDialog } from "@/components/tenant/settings/issue";
import { revokeInviteChange } from "@/components/tenant/settings/mutation.client";
import { cardOffered } from "@/components/tenant/settings/offer";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";
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
export function SchoolInvitesSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const sendLocale = Option.getOrUndefined(
    Schema.decodeOption(ActiveAppLocaleCodeSchema)(locale)
  );
  const [isInviting, setIsInviting] = useState(false);

  return (
    <SettingsPage
      actions={
        <Button onClick={() => setIsInviting(true)} type="button">
          {t("invite-action")}
        </Button>
      }
    >
      <ReadBoundary>
        <SchoolInvitesBody sendLocale={sendLocale} slug={slug} />
      </ReadBoundary>
      <SchoolInviteDialog
        open={isInviting}
        setOpen={setIsInviting}
        slug={slug}
      />
    </SettingsPage>
  );
}

/** The invites of the school, read a page at a time, with the table and its end. */
function SchoolInvitesBody({
  sendLocale,
  slug,
}: {
  sendLocale: typeof ActiveAppLocaleCodeSchema.Type | undefined;
  slug: TenantSlug;
}) {
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
        <SchoolInviteTable
          invites={pagination.results}
          sendLocale={sendLocale}
          slug={slug}
        />
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The invites in a data table, or the table's empty state when there is none. */
function SchoolInviteTable({
  invites,
  sendLocale,
  slug,
}: {
  invites: readonly InviteItem[];
  sendLocale: typeof ActiveAppLocaleCodeSchema.Type | undefined;
  slug: TenantSlug;
}) {
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
        <div className="flex flex-wrap gap-1">
          {Arr.map(info.row.original.roles, (role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      ),
      header: t("invite-role"),
      id: "role",
    }),
    inviteColumns.accessor((invite) => invite.expiresAt, {
      cell: (info) =>
        info.row.original.status === "expired" ? (
          t("invite-expired")
        ) : (
          <SchoolDateTime at={info.getValue()} slug={slug} />
        ),
      header: t("invite-expires"),
      id: "expires",
      sortFn: "basic",
    }),
    inviteColumns.display({
      cell: (info) => (
        <SchoolInviteMenu
          invite={info.row.original}
          sendLocale={sendLocale}
          slug={slug}
        />
      ),
      id: "actions",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={invites}
      rowId={(invite) => invite.id}
      search={{ column: "name", placeholder: t("invites-search") }}
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
function SchoolInviteMenu({
  invite,
  sendLocale,
  slug,
}: {
  invite: InviteItem;
  sendLocale: typeof ActiveAppLocaleCodeSchema.Type | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
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
            {t("invite-resend")}
          </DropdownMenuItem>
          {isExpired ? null : (
            <>
              {cardOffered(invite.roles) ? (
                <DropdownMenuItem onClick={() => setIsIssuing(true)}>
                  {t("invite-card")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsRevoking(true)}
                variant="destructive"
              >
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
      <SchoolCardDialog
        card={issued}
        onClose={() => setIssued(undefined)}
        slug={slug}
      />
    </div>
  );
}
