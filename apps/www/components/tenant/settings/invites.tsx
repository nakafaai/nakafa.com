"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
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
import { Array as Arr, Option, Schema } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import { CardSection } from "@/components/shared/card/section";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolTableHeader } from "@/components/tenant/settings/table";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/settings/invites";

/** How many invites one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One pending invite as the invites list shows it. */
type InviteItem = PaginatedQueryItem<typeof tenancy.invites.list>;

/**
 * Renders the pending invites of the school, each with its expiry, and the actions
 * to send an invite again or to revoke it. The list loads more rows as its end
 * comes into view.
 */
export function SchoolInvitesSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const locale = useLocale();
  const pagination = usePaginatedQuery(
    tenancy.invites.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );
  const sendLocale = Option.getOrUndefined(
    Schema.decodeOption(ActiveAppLocaleCodeSchema)(locale)
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("invites")}</CardTitle>
        <CardDescription>{t("invites-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <SchoolTableHeader
            columns={[
              t("invite-name"),
              t("invite-email"),
              t("invite-expires"),
              "",
            ]}
          />
          <TableBody>
            {Arr.map(pagination.results, (invite) => (
              <SchoolInviteRow
                invite={invite}
                key={invite.id}
                sendLocale={sendLocale}
                slug={slug}
              />
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

/** Renders one invite row: its person, its address, its expiry, and its actions. */
function SchoolInviteRow({
  invite,
  sendLocale,
  slug,
}: {
  invite: InviteItem;
  sendLocale: typeof ActiveAppLocaleCodeSchema.Type | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const resend = useMutation(tenancy.invites.resend);
  const revoke = useMutation(tenancy.invites.revoke);
  const [isRevoking, setIsRevoking] = useState(false);

  return (
    <TableRow>
      <TableCell>{invite.name}</TableCell>
      <TableCell>{invite.email}</TableCell>
      <TableCell>
        <SchoolDateTime at={invite.expiresAt} slug={slug} />
      </TableCell>
      <TableCell className="text-right">
        <Button
          disabled={sendLocale === undefined}
          onClick={() => {
            if (sendLocale !== undefined) {
              startTransition(() =>
                saveSchool(
                  () =>
                    resend({
                      inviteId: invite.id,
                      locale: sendLocale,
                      slug,
                    }),
                  SOURCE
                )
              );
            }
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {t("invite-resend")}
        </Button>
        <Button
          onClick={() => setIsRevoking(true)}
          size="sm"
          type="button"
          variant="destructive"
        >
          {t("invite-revoke")}
        </Button>
        <ResponsiveDialog
          description={t("invite-revoke-description")}
          footer={
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
          }
          open={isRevoking}
          setOpen={setIsRevoking}
          title={t("invite-revoke-title")}
        />
      </TableCell>
    </TableRow>
  );
}
