"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import {
  DataTable,
  type dataTableFeatures,
} from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { SettingsPage } from "@/components/tenant/settings/page";
import { SchoolDateTime } from "@/components/tenant/settings/time";

/** How many entries one page of the journal loads, and each page after it. */
const PAGE_SIZE = 25;

/** One journal entry as the audit list shows it. */
type EntryItem = PaginatedQueryItem<typeof journal.audit.list>;

/** The columns of the audit table. */
const entryColumns = createColumnHelper<typeof dataTableFeatures, EntryItem>();

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolAuditSettings({ slug }: { slug: TenantSlug }) {
  return (
    <SettingsPage>
      <SchoolAuditBody slug={slug} />
    </SettingsPage>
  );
}

/**
 * Renders the audit log of the school, newest first, in a data table that filters by who
 * made each change and searches the changes, and loads more rows as its end comes into
 * view, with the policy note under it. The rows hold no policy value and no secret, so the
 * page shows none. The body waits for the first page, and an empty school shows the empty
 * state alone.
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
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <TableEmpty
        act="reading"
        description={t("audit-description")}
        title={t("audit-empty")}
      />
    );
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

  const columns = entryColumns.columns([
    entryColumns.accessor((entry) => entry.at, {
      cell: (info) => <SchoolDateTime at={info.getValue()} slug={slug} />,
      header: t("audit-when"),
      id: "when",
      sortFn: "basic",
    }),
    entryColumns.accessor(actorLabel, {
      filterFn: "arrIncludesSome",
      header: t("audit-who"),
      id: "who",
      sortFn: "text",
    }),
    entryColumns.accessor((entry) => t(`audit-label.${entry.change.type}`), {
      filterFn: "includesString",
      header: t("audit-change"),
      id: "change",
      sortFn: "text",
    }),
  ]);
  const actors = Arr.dedupe(Arr.map(pagination.results, actorLabel));

  return (
    <>
      <div>
        <DataTable
          columns={columns}
          data={pagination.results}
          facets={[
            {
              column: "who",
              options: Arr.map(actors, (name) => ({
                label: name,
                value: name,
              })),
              title: t("audit-who"),
            },
          ]}
          rowId={(entry) => entry.id}
          search={{ column: "change", placeholder: t("audit-search") }}
        />
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </div>
      <p className="text-muted-foreground text-sm">{t("audit-footer")}</p>
    </>
  );
}
