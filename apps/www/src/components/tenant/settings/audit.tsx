import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
} from "@confect/react";
import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext, use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SettingsPage } from "@/components/tenant/settings/section";
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

/** The section in the settings page frame, whose header shows while its body loads. */
export function SchoolAuditSettings({
  preload,
  slug,
}: {
  preload: AuditPreload | undefined;
  slug: TenantSlug;
}) {
  return (
    <SettingsPage>
      <ReadBoundary>
        <AuditPreloadContext value={preload}>
          <SchoolAuditBody slug={slug} />
        </AuditPreloadContext>
      </ReadBoundary>
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
  const people = usePreloadedQueryResult(
    journal.audit.actors,
    { slug },
    preload?.people
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
  // The filter lists every active member of the school, so an actor on a later page is offered
  // before that page loads, beside the staff and the system that the journal also records.
  const actors = Arr.dedupe([
    ...(QueryResult.isSuccess(people)
      ? Arr.map(people.value, (person) => person.name)
      : []),
    t("audit-operator"),
    t("audit-system"),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
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
