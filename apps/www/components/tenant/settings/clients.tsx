"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import integrations from "@repo/backend/confect/_generated/refs/integrations";
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
import { CardSection } from "@/components/shared/card/section";
import { revokeClientChange } from "@/components/tenant/settings/mutation.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolSecretDialog } from "@/components/tenant/settings/secret";
import { SchoolTableHeader } from "@/components/tenant/settings/table";

const SOURCE = "components/tenant/settings/clients";

/** How many clients one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One integration client as the clients list shows it. */
type ClientItem = PaginatedQueryItem<typeof integrations.clients.list>;

/**
 * Renders the integration clients of the school. A client is rotated, which issues a
 * new secret that is shown once, or revoked. Creating a client is not built yet.
 */
export function SchoolClientsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [issuedSecret, setIssuedSecret] = useState<string | undefined>(
    undefined
  );
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
              t("client-actions"),
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
      <TableCell>{client.actions.length}</TableCell>
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
