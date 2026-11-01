import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Archive02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { DEFAULT_GRADING_SCHEME } from "@repo/backend/confect/records/scheme";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, DateTime, Option, Schema } from "effect";
import { startTransition } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useDialogs } from "@/components/shared/dialogs";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { WithAction } from "@/components/tenant/action";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";
import {
  SchemeVersionAdd,
  SchemeVersionDialog,
} from "@/components/tenant/settings/scheme";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import {
  removeSchemeChange,
  type SchemeVersion,
  SchemeVersionsContext,
} from "@/components/tenant/settings/versions";

const SOURCE = "components/tenant/settings/grading";

/** How many versions one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** Whether a version is the one in force, the newest, or an earlier one that judged the grades of its time. */
const VersionStatus = Schema.Literals(["current", "earlier"]);

/** The look of each version status, in its cell and in its column's filter: the target in force, and an archive. */
const VERSION_LOOKS = {
  current: { icon: Target02Icon, tone: "success" },
  earlier: { icon: Archive02Icon, tone: "neutral" },
} as const satisfies Record<typeof VersionStatus.Type, StatusLook>;

/** The columns of the versions table. */
const versionColumns = tableColumns<SchemeVersion>();

/**
 * The versions of the school's grading scheme, the newest first, which is the version in force: when each took
 * effect, its KKTP and its bands. The header holds the search and New version from the first paint, and New version
 * waits disabled until the versions are read, so it opens with the version in force.
 */
export function SchoolGradingSettings() {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    records.schemes.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const isRead = pagination._tag !== "LoadingFirstPage";

  return (
    <TableFiltersProvider>
      <SchemeVersionsContext
        value={{
          newest: isRead ? Arr.head(pagination.results) : Option.none(),
          ready: isRead,
        }}
      >
        <SettingsTablePage
          actions={
            <>
              <TableSearch placeholder={t("grading-search")} />
              <WithAction action="scheme.manage">
                <SchemeVersionAdd />
              </WithAction>
            </>
          }
        >
          {isRead ? (
            <GradingTable
              failed={PaginatedQueryResult.isFailure(pagination)}
              loadMore={
                PaginatedQueryResult.isCanLoadMore(pagination)
                  ? () => pagination.loadMore(PAGE_SIZE)
                  : null
              }
              versions={pagination.results}
            />
          ) : null}
        </SettingsTablePage>
      </SchemeVersionsContext>
    </TableFiltersProvider>
  );
}

/**
 * The table of the school's versions, or the sentence of a school that judges its grades by the built-in scheme,
 * with the next page read as its end comes into view.
 */
function GradingTable({
  failed,
  loadMore,
  versions,
}: {
  failed: boolean;
  loadMore: (() => void) | null;
  versions: readonly SchemeVersion[];
}) {
  const t = useTranslations("SchoolSettings");
  const formatZone = useFormatTimeZone();
  const format = useFormatter();

  if (Arr.isReadonlyArrayEmpty(versions)) {
    return failed ? (
      <LoadFailure onRetry={reloadPage} />
    ) : (
      <TableEmpty
        act="thinking"
        description={t("grading-empty-description", {
          kktp: DEFAULT_GRADING_SCHEME.kktp,
        })}
        title={t("grading-empty")}
      />
    );
  }

  const newest = Option.map(Arr.head(versions), (version) => version.id);
  const columns = [
    versionColumns.days((row) => row.effectiveFrom, {
      cell: (info) => (
        <span className="font-medium tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium", timeStyle: "short" }
          )}
        </span>
      ),
      header: t("grading-effective"),
      id: "effective",
      timeZone: formatZone,
    }),
    versionColumns.number((row) => row.kktp, {
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      header: t("grading-kktp"),
      id: "kktp",
    }),
    versionColumns.text(
      (row) =>
        Arr.join(
          Arr.map(row.bands, (band) => band.label),
          " "
        ),
      {
        cell: (info) =>
          Arr.isReadonlyArrayEmpty(info.row.original.bands) ? (
            <span className="text-muted-foreground">
              {t("grading-bands-none")}
            </span>
          ) : (
            <span>
              {Arr.join(
                Arr.map(info.row.original.bands, (band) =>
                  t("grading-band", {
                    label: band.label,
                    minimum: band.minimum,
                  })
                ),
                ", "
              )}
            </span>
          ),
        header: t("grading-bands"),
        id: "bands",
      }
    ),
    versionColumns.values(
      (row): typeof VersionStatus.Type =>
        Option.contains(newest, row.id) ? "current" : "earlier",
      {
        cell: (info) => (
          <TableStatus
            icon={VERSION_LOOKS[info.getValue()].icon}
            label={t(`grading-${info.getValue()}`)}
            tone={VERSION_LOOKS[info.getValue()].tone}
          />
        ),
        header: t("grading-status"),
        id: "status",
        options: Arr.map(VersionStatus.literals, (status) => ({
          icon: VERSION_LOOKS[status].icon,
          label: t(`grading-${status}`),
          value: status,
        })),
      }
    ),
    versionColumns.menu((info) => (
      <SchemeVersionMenu version={info.row.original} />
    )),
  ];

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={versions}
        rowId={(row) => row.id}
        search="bands"
      />
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </>
  );
}

/**
 * A version's menu, for whoever manages the scheme: Edit and Delete, while the version has judged no
 * grade. A version that has judged one stays as it is, because each grade keeps the version that
 * judged it, so it has no menu. Delete asks first, and the version leaves the list at once.
 */
function SchemeVersionMenu({ version }: { version: SchemeVersion }) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const { reach, slug } = useTenant();
  const remove = useMutation(records.schemes.remove).withOptimisticUpdate(
    removeSchemeChange
  );
  const dialogs = useDialogs<"edit" | "remove">();

  if (version.used || !Arr.contains(reach, "scheme.manage")) {
    return null;
  }
  return (
    <>
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
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => dialogs.show("edit")}>
            <HugeIcons icon={PencilEdit02Icon} />
            {t("grading-edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => dialogs.show("remove")}
            variant="destructive"
          >
            <HugeIcons icon={Delete02Icon} />
            {t("grading-remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs.kind === "edit" ? (
        <SchemeVersionDialog editing={Option.some(version)} key={dialogs.key} />
      ) : null}
      <ResponsiveDialog
        description={t("grading-remove-description")}
        footer={
          <>
            <Button onClick={dialogs.close} variant="outline">
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                dialogs.close();
                startTransition(() =>
                  saveSchool(
                    () => remove({ schemeId: version.id, slug }),
                    SOURCE
                  )
                );
              }}
              variant="destructive"
            >
              {t("grading-remove")}
            </Button>
          </>
        }
        open={dialogs.isOpen("remove")}
        setOpen={dialogs.setOpen}
        title={t("grading-remove-title")}
      />
    </>
  );
}
