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
} from "@hugeicons/core-free-icons";
import journal from "@repo/backend/confect/_generated/refs/journal";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { Array as Arr, Effect, Option } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { PERSON_ICONS } from "@/components/tenant/settings/choices";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import {
  SchoolDateTime,
  useSchoolTimeZone,
} from "@/components/tenant/settings/time";

/** How many entries one page of the journal loads, and each page after it. */
const PAGE_SIZE = 25;

/** One journal entry as the audit list shows it. */
type EntryItem = PaginatedQueryItem<typeof journal.audit.list>;

/** The columns of the audit table. */
const entryColumns = tableColumns<EntryItem>();

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
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/**
 * The values of the audit's Who column, which filters the changes by who made them. It lists every active member of the
 * school, so an actor on a later page is offered before that page loads, beside the staff and the system that the
 * journal also records.
 */
function useAuditActors() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const people = useQuery(journal.audit.actors, { slug });

  return namedOptions(
    Arr.dedupe([
      ...(QueryResult.isSuccess(people)
        ? Arr.map(people.value, (person) => person.name)
        : []),
      t("audit-actor.client"),
      t("audit-actor.operator"),
      t("audit-actor.system"),
    ]),
    PERSON_ICONS
  );
}

/**
 * Renders the audit log of the school, newest first, in a data table that filters by who
 * made each change and searches the changes, and loads more rows as its end comes into
 * view. The rows hold no policy value and no secret, so the page shows none. The body waits for the first page, and an empty school shows the empty
 * state alone. The note of what the trail leaves out closes the empty state, and the table once its last page is in.
 */
function SchoolAuditBody() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const formatZone = useFormatTimeZone();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const words = useEntryWords();
  const actors = useAuditActors();
  const timeZone = useSchoolTimeZone();
  const pagination = usePaginatedQuery(
    journal.audit.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const columns = [
    entryColumns.days((entry) => entry.at, {
      cell: (info) => <SchoolDateTime at={info.getValue()} />,
      header: t("audit-when"),
      id: "when",
      timeZone: () => Option.getOrElse(timeZone, formatZone),
    }),
    entryColumns.values(words.actor, {
      header: t("audit-who"),
      id: "who",
      options: actors,
    }),
    entryColumns.text(words.change, {
      header: t("audit-change"),
      id: "change",
    }),
    entryColumns.menu((info) => <AuditEntryMenu entry={info.row.original} />),
  ];
  return (
    <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
      <DataTable
        columns={columns}
        data={pagination.results}
        empty={
          <TableEmpty
            act="reading"
            description={t("audit-description")}
            title={t("audit-empty")}
          />
        }
        rowId={(entry) => entry.id}
        search="change"
      />
      {PaginatedQueryResult.isExhausted(pagination) ? <AuditFooter /> : null}
    </TablePages>
  );
}

/**
 * The note at the foot of the trail: what it leaves out. It arrives with the answer that it closes, so neither the
 * first page nor a page that loads at the end of the table moves it.
 */
function AuditFooter() {
  const t = useTranslations("SchoolSettings");

  return (
    <p className="text-muted-foreground mt-auto border-t px-4 py-3 text-sm">
      {t("audit-footer")}
    </p>
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
      return t(`audit-actor.${entry.actor.kind}`);
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
    <>
      <RowItems>
        <DropdownMenuItem onClick={() => setOpen(true)}>
          <HugeIcons icon={InformationCircleIcon} />
          {t("audit-details")}
        </DropdownMenuItem>
      </RowItems>
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
    </>
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
      <span className="@max-sm/header:sr-only">{t("audit-export")}</span>
    </Button>
  );
}
