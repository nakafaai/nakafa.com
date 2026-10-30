import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  Download01Icon,
  InformationCircleIcon,
  MoreHorizontalIcon,
  UserAccountIcon,
  UserCheck01Icon,
  UserCircleIcon,
  UserEdit01Icon,
  UserIcon,
  UserLove01Icon,
  UserSettings01Icon,
  UserShield01Icon,
  UserSquareIcon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { toast } from "@repo/design-system/lib/toast/notify";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Effect, Option } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { SchoolDateTime } from "@/components/tenant/settings/time";

/** The icons of the people in the Who column's filter, one of a person for each. */
const PERSON_ICONS = [
  UserIcon,
  UserCircleIcon,
  UserSquareIcon,
  UserStar01Icon,
  UserAccountIcon,
  UserCheck01Icon,
  UserEdit01Icon,
  UserLove01Icon,
  UserSettings01Icon,
  UserShield01Icon,
] as const;

/** How many entries one page of the journal loads, and each page after it. */
const PAGE_SIZE = 25;

/** One journal entry as the audit list shows it. */
type EntryItem = PaginatedQueryItem<typeof journal.audit.list>;

/** The columns of the audit table. */
const entryColumns = createColumnHelper<typeof dataTableFeatures, EntryItem>();

/**
 * The audit trail as the page's table. The header row searches the changes and exports the
 * whole trail, the Who column filters them by who made them, and the header shows while the body loads.
 */
export function SchoolAuditSettings() {
  const t = useTranslations("SchoolSettings");

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("audit-search")} />
            <AuditExport />
          </>
        }
      >
        <ReadBoundary>
          <SchoolAuditBody />
        </ReadBoundary>
        <p className="mt-auto border-t px-4 py-3 text-muted-foreground text-sm">
          {t("audit-footer")}
        </p>
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/**
 * The head of the audit's Who column, which filters the changes by who made them. It lists every active member of the
 * school, so an actor on a later page is offered before that page loads, beside the staff and the system that the
 * journal also records.
 */
function AuditWhoFilter() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const people = useQuery(journal.audit.actors, { slug });
  const actors = Arr.dedupe([
    ...(QueryResult.isSuccess(people)
      ? Arr.map(people.value, (person) => person.name)
      : []),
    t("audit-operator"),
    t("audit-system"),
  ]);

  return (
    <ColumnFilter
      column="who"
      options={namedOptions(actors, PERSON_ICONS)}
      title={t("audit-who")}
    />
  );
}

/**
 * Renders the audit log of the school, newest first, in a data table that filters by who
 * made each change and searches the changes, and loads more rows as its end comes into
 * view. The rows hold no policy value and no secret, so the page shows none. The body waits for the first page, and an empty school shows the empty
 * state alone.
 */
function SchoolAuditBody() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const words = useEntryWords();
  const pagination = usePaginatedQuery(
    journal.audit.list,
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
        act="reading"
        description={t("audit-description")}
        title={t("audit-empty")}
      />
    );
  }

  const columns = entryColumns.columns([
    entryColumns.accessor((entry) => entry.at, {
      cell: (info) => <SchoolDateTime at={info.getValue()} />,
      header: t("audit-when"),
      id: "when",
      meta: { align: "end" },
      sortFn: "basic",
    }),
    entryColumns.accessor(words.actor, {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => <AuditWhoFilter />,
      id: "who",
    }),
    entryColumns.accessor(words.change, {
      filterFn: "includesString",
      header: t("audit-change"),
      id: "change",
      sortFn: "text",
    }),
    entryColumns.display({
      cell: (info) => <AuditEntryMenu entry={info.row.original} />,
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
        rowId={(entry) => entry.id}
        search="change"
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** The words the audit gives an entry: who made the change, and what it changed. */
function useEntryWords() {
  const t = useTranslations("SchoolSettings");

  return {
    actor: (entry: EntryItem) => {
      if (entry.actor.kind === "person") {
        return entry.actor.name;
      }
      return entry.actor.kind === "operator"
        ? t("audit-operator")
        : t("audit-system");
    },
    change: (entry: EntryItem) => t(`audit-label.${entry.change.type}`),
  };
}

/**
 * The row menu of one change of the trail: Details, which opens the change in a sheet. The sheet says when it
 * happened, who made it, what it was, and the name of what it changed when the trail recorded one. The trail holds
 * no policy value and no secret, so the sheet shows none.
 */
function AuditEntryMenu({ entry }: { entry: EntryItem }) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const words = useEntryWords();
  const [open, setOpen] = useState(false);

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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <HugeIcons icon={InformationCircleIcon} />
              {t("audit-details")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{words.change(entry)}</SheetTitle>
            <SheetDescription>
              {t("audit-details-description")}
            </SheetDescription>
          </SheetHeader>
          <dl className="grid min-h-0 flex-1 grid-cols-[auto_1fr] content-start gap-x-6 gap-y-3 overflow-y-auto p-4 text-sm">
            <dt className="text-muted-foreground">{t("audit-when")}</dt>
            <dd className="tabular-nums">
              <SchoolDateTime at={entry.at} />
            </dd>
            <dt className="text-muted-foreground">{t("audit-who")}</dt>
            <dd dir="auto">{words.actor(entry)}</dd>
            <dt className="text-muted-foreground">{t("audit-change")}</dt>
            <dd>{words.change(entry)}</dd>
            {Option.match(entry.subjectName, {
              onNone: () => null,
              onSome: (name) => (
                <>
                  <dt className="text-muted-foreground">
                    {t("audit-subject")}
                  </dt>
                  <dd dir="auto">{name}</dd>
                </>
              ),
            })}
          </dl>
          <SheetFooter>
            <SheetClose
              render={
                <Button type="button" variant="outline">
                  {common("close")}
                </Button>
              }
            />
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Hands the viewer a text as a file of the given name. */
const saveFile = (name: string, text: string) =>
  Effect.sync(() => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  });

/**
 * Saves the school's whole trail as a CSV file with the columns of the table: the time of each
 * entry, then the words that `describe` gives it. The reader of the trail loads on the press, and
 * a failed export says so in a toast, logs its cause and leaves the page as it was.
 */
const exportAuditTrail = Effect.fn("tenant.audit.export")(
  function* (
    slug: TenantSlug,
    header: readonly string[],
    describe: (entry: EntryItem) => readonly string[]
  ) {
    const trail = yield* Effect.tryPromise(
      () => import("@/components/tenant/settings/export")
    );
    const entries = yield* trail.readAuditTrail(slug);
    const text = trail.csvText([
      header,
      ...Arr.map(entries, (entry) => [
        trail.entryTime(entry.at),
        ...describe(entry),
      ]),
    ]);
    yield* saveFile(yield* trail.auditFileName(slug), text);
  },
  Effect.catchCause((cause) =>
    Effect.andThen(
      Effect.logError("tenant.audit.export failed", cause),
      Effect.sync(() => {
        toast.error(
          {
            description: "audit-export-error.description",
            title: "audit-export-error.title",
          },
          { position: "bottom-center" }
        );
      })
    )
  )
);

/**
 * The audit's main action: the school's whole trail as a CSV file that the school can keep or hand
 * to an inspector. The button waits while the file is made.
 */
function AuditExport() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const words = useEntryWords();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(() =>
          Effect.runPromise(
            exportAuditTrail(
              slug,
              [t("audit-when"), t("audit-who"), t("audit-change")],
              (entry) => [words.actor(entry), words.change(entry)]
            )
          )
        )
      }
    >
      <HugeIcons icon={Download01Icon} />
      {t("audit-export")}
    </Button>
  );
}
