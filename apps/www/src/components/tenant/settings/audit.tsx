import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
} from "@confect/react";
import { UserIcon } from "@hugeicons/core-free-icons";
import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext, use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFilter,
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { SchoolDateTime } from "@/components/tenant/settings/time";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import type { readAuditFn } from "@/lib/tenant/settings.functions";

/** How many entries one page of the journal loads, and each page after it. */
export const PAGE_SIZE = 25;

/** One journal entry as the audit list shows it. */
type EntryItem = PaginatedQueryItem<typeof journal.audit.list>;

/** The audit's first screen as its loader reads it on the server. */
type AuditFirstScreen = Awaited<ReturnType<typeof readAuditFn>>;

/**
 * An audit entry as the loader sends it to the page: the subject's name is a string, or none, because an
 * Option does not cross the server boundary. The page restores the Option before it reads the entry.
 */
type EntryWire = NonNullable<AuditFirstScreen["entries"]>["page"][number];

/** The first screen of the audit: the first page of its entries, and the people who appear in them. */
type AuditPreload = Pick<AuditFirstScreen, "entries" | "people">;

/** The loader's entry with its subject name as the page reads it. */
function restoreEntry(entry: EntryWire): EntryItem {
  return { ...entry, subjectName: Option.fromNullishOr(entry.subjectName) };
}

/** The columns of the audit table. */
const entryColumns = createColumnHelper<typeof dataTableFeatures, EntryItem>();

/** The audit's first screen, which the page's loader read on the server. */
const AuditPreloadContext = createContext<AuditPreload | undefined>(undefined);

/**
 * The audit trail as the page's table. The header row searches the changes and filters them
 * by who made them, and shows while the body loads.
 */
export function SchoolAuditSettings({
  preload,
  slug,
}: {
  preload: AuditPreload | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("audit-search")} />
            <AuditFilter people={preload?.people} slug={slug} />
          </>
        }
      >
        <ReadBoundary>
          <AuditPreloadContext value={preload}>
            <SchoolAuditBody slug={slug} />
          </AuditPreloadContext>
        </ReadBoundary>
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/**
 * The audit's Filter menu, by who made each change. It lists every active member of the
 * school, so an actor on a later page is offered before that page loads, beside the staff
 * and the system that the journal also records.
 */
function AuditFilter({
  people: preloaded,
  slug,
}: {
  people: AuditPreload["people"] | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const people = usePreloadedQueryResult(
    journal.audit.actors,
    { slug },
    preloaded
  );
  const actors = Arr.dedupe([
    ...(QueryResult.isSuccess(people)
      ? Arr.map(people.value, (person) => person.name)
      : []),
    t("audit-operator"),
    t("audit-system"),
  ]);

  return (
    <TableFilter
      facets={[
        {
          column: "who",
          icon: UserIcon,
          options: Arr.map(actors, (name) => ({ label: name, value: name })),
          title: t("audit-who"),
        },
      ]}
    />
  );
}

/**
 * Renders the audit log of the school, newest first, in a data table that filters by who
 * made each change and searches the changes, and loads more rows as its end comes into
 * view. The rows hold no policy value and no secret, so the page shows none. The body waits for the first page, and an empty school shows the empty
 * state alone.
 */
function SchoolAuditBody({ slug }: { slug: TenantSlug }) {
  const preload = use(AuditPreloadContext);
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const first =
    preload?.entries === undefined
      ? undefined
      : {
          isDone: preload.entries.isDone,
          page: Arr.map(preload.entries.page, restoreEntry),
        };
  const pagination = usePaginatedPreloaded(
    journal.audit.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE },
    Option.fromUndefinedOr(first)
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
      cell: (info) => <SchoolDateTime at={info.getValue()} />,
      header: t("audit-when"),
      id: "when",
      sortFn: "basic",
    }),
    entryColumns.accessor(actorLabel, {
      filterFn: "oneOf",
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
  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        rowId={(entry) => entry.id}
        search="change"
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}
