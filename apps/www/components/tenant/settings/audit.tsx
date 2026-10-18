"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import {
  CardSection,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { SettingsPage } from "@/components/tenant/settings/page";
import { SchoolTableHeader } from "@/components/tenant/settings/table";
import { SchoolDateTime } from "@/components/tenant/settings/time";

/** How many entries one page of the journal loads, and each page after it. */
const PAGE_SIZE = 25;

/** One journal entry as the audit list shows it. */
type EntryItem = PaginatedQueryItem<typeof journal.audit.list>;

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolAuditSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <SchoolAuditBody slug={slug} />
    </SettingsPage>
  );
}

/**
 * Renders the audit log of the school, newest first: who made each change, the
 * label of the change, and when it was made. The rows hold no policy value and no
 * secret, so the page shows none.
 */
function SchoolAuditBody({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    journal.audit.list,
    { slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  /** The name of who made one change: a Person by name, Nakafa staff, or the system. */
  const actorLabel = (entry: EntryItem) => {
    if (entry.actor.kind === "person") {
      return entry.actor.name;
    }
    return entry.actor.kind === "operator"
      ? t("audit-operator")
      : t("audit-system");
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("audit")}</CardTitle>
        <CardDescription>{t("audit-description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <SchoolTableHeader
            columns={[t("audit-when"), t("audit-who"), t("audit-change")]}
          />
          <TableBody>
            {Arr.map(pagination.results, (entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <SchoolDateTime at={entry.at} slug={slug} />
                </TableCell>
                <TableCell>{actorLabel(entry)}</TableCell>
                <TableCell>{t(`audit-label.${entry.change.type}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("audit-footer")}</CardSectionHint>
      </CardSectionFooter>
    </CardSection>
  );
}
