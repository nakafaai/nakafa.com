import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { Archive02Icon, Presentation01Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { ClassStatus } from "@repo/backend/confect/classroom/class";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext, use, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { WithAction } from "@/components/tenant/action";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { SchoolClassAdd } from "@/components/tenant/settings/class/add";
import type { SchoolClass } from "@/components/tenant/settings/class/changes";
import {
  SchoolClassMenu,
  SchoolClassRestore,
} from "@/components/tenant/settings/class/menu";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { isDraft, type Period } from "@/components/tenant/settings/state";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";
import { Link } from "@/lib/routing/link";

/** The look of each classroom status, in its table cell and in its column's filter: a lesson, and an archive. */
const CLASS_STATUS_LOOKS = {
  active: { icon: Presentation01Icon, tone: "success" },
  archived: { icon: Archive02Icon, tone: "neutral" },
} as const satisfies Record<typeof ClassStatus.Type, StatusLook>;

/** How many classrooms one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The columns of the classrooms table. */
const classColumns = createColumnHelper<
  typeof dataTableFeatures,
  SchoolClass
>();

/** The school's units as the viewer reads them, each with its level. */
type ViewerUnits = Ref.Returns<typeof tenancy.viewer.get>["units"];

/**
 * The unit whose classrooms the page shows, the school's units, and the choice of another one. It is null while the
 * viewer's units are read and for a school with no active unit, so the page's actions read it in every state.
 */
const ClassesUnitContext = createContext<{
  onChoose: (unitId: UnitId) => void;
  unit: ViewerUnits[number];
  units: ViewerUnits;
} | null>(null);

/**
 * The active period of the page's unit, read once Convex has settled the session: pending while the unit or the
 * period is read, null for a unit with none, and a failure the page shows or throws.
 */
function useActivePeriod() {
  const { slug } = useTenant();
  const chosen = use(ClassesUnitContext);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return useQuery(
    tenancy.cohorts.activePeriod,
    isSettled && chosen !== null ? { slug, unitId: chosen.unit.id } : "skip"
  );
}

/**
 * Renders the classrooms of the school's unit, which belong to the cohorts of the unit's active period, in a table
 * with each classroom's row menu. A school with no active unit says so and links to the units, because a classroom
 * belongs to a cohort of a period of a unit.
 */
export function SchoolClassesSettings({ slug }: { slug: TenantSlug }) {
  return (
    <TableFiltersProvider>
      <ReadBoundary
        fallback={(failure) => (
          <SettingsTablePage actions={<ClassesActions />}>
            {failure}
          </SettingsTablePage>
        )}
        read={{ args: { slug }, ref: tenancy.viewer.get }}
      >
        <SchoolClassesContent />
      </ReadBoundary>
    </TableFiltersProvider>
  );
}

/**
 * The page's actions, drawn final from the first paint and never changed by the unit's or the period's answer: the
 * unit choice for a school with more than one unit, the search, and Add classroom, whose dialog waits for the period
 * itself.
 */
function ClassesActions() {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const chosen = use(ClassesUnitContext);
  const active = useActivePeriod();

  return (
    <>
      <ButtonGroup>
        {chosen !== null && chosen.units.length > 1 ? (
          <SchoolUnitChoice
            onChoose={chosen.onChoose}
            unitId={chosen.unit.id}
            units={chosen.units}
          />
        ) : null}
        <TableSearch placeholder={t("classes-search")} />
      </ButtonGroup>
      <WithAction action="class.create">
        <SchoolClassAdd
          active={active}
          sd={chosen !== null && chosen.unit.level === "sd"}
          slug={slug}
        />
      </WithAction>
    </>
  );
}

/** The classrooms of the school's active unit, or of the unit chosen, once the viewer's units are in. */
function SchoolClassesContent() {
  const viewer = useViewerQuery();
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return (
      <SettingsTablePage actions={<ClassesActions />}>{null}</SettingsTablePage>
    );
  }
  const units = viewer.value.units;
  const unit = Option.getOrUndefined(
    Arr.findFirst(units, (candidate) =>
      chosenUnit === undefined
        ? candidate.status === "active"
        : candidate.id === chosenUnit
    )
  );

  if (unit === undefined) {
    return (
      <SettingsTablePage actions={<ClassesActions />}>
        <NoActiveUnit />
      </SettingsTablePage>
    );
  }
  return (
    <ClassesUnitContext value={{ onChoose: setChosenUnit, unit, units }}>
      <SchoolClassesOfPeriod />
    </ClassesUnitContext>
  );
}

/**
 * The table of the unit's active period, or the state of a unit that has none, once the period is read. A unit
 * with no active period links to the periods, and a unit the viewer may not read says so.
 */
function SchoolClassesOfPeriod() {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const active = useActivePeriod();

  if (QueryResult.isFailure(active)) {
    if (!isDenied(active.error)) {
      throw active.error;
    }
    return (
      <SettingsTablePage actions={<ClassesActions />}>
        <TableEmpty
          act="pointing"
          description={t("classes-unavailable-description")}
          title={t("classes-unavailable")}
        />
      </SettingsTablePage>
    );
  }
  if (!QueryResult.isSuccess(active)) {
    return (
      <SettingsTablePage actions={<ClassesActions />}>{null}</SettingsTablePage>
    );
  }
  if (active.value === null) {
    return (
      <SettingsTablePage actions={<ClassesActions />}>
        <TableEmpty
          act="pointing"
          action={
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ slug }}
              to="/school/$slug/settings/periods"
            >
              {t("cohorts-no-period-action")}
            </Link>
          }
          description={t("classes-no-period")}
          title={t("cohorts-no-period-title")}
        />
      </SettingsTablePage>
    );
  }
  return (
    <SettingsTablePage actions={<ClassesActions />}>
      <ReadBoundary>
        <SchoolClassTable periodId={active.value} />
      </ReadBoundary>
    </SettingsTablePage>
  );
}

/**
 * Renders the classrooms of one period in a data table that finds a name, filters by status in its column, sorts,
 * and loads more rows as its end comes into view, or the table's empty state while the period has none. The table
 * waits for its first page, so no empty state shows before the rows arrive.
 */
function SchoolClassTable({ periodId }: { periodId: Period["id"] }) {
  const t = useTranslations("SchoolSettings");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    classroom.classes.list,
    isSettled ? { periodId, slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <LoadFailure onRetry={reloadPage} />;
    }
    return (
      <TableEmpty
        act="writing"
        description={t("classes-description")}
        title={t("classes-empty")}
      />
    );
  }

  const columns = classColumns.columns([
    classColumns.accessor((row) => row.name, {
      cell: (info) =>
        isDraft(info.row.original.id) ? (
          <span className="font-medium">{info.getValue()}</span>
        ) : (
          <Link
            className="font-medium"
            params={{ classSlug: info.row.original.slug, slug }}
            to="/school/$slug/classes/$classSlug"
          >
            {info.getValue()}
          </Link>
        ),
      filterFn: "includesString",
      header: t("class-name"),
      id: "name",
      sortFn: "text",
    }),
    classColumns.accessor((row) => row.status, {
      cell: (info) => (
        <TableStatus
          icon={CLASS_STATUS_LOOKS[info.getValue()].icon}
          label={t(`class-${info.getValue()}`)}
          tone={CLASS_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(ClassStatus.literals, (status) => ({
            icon: CLASS_STATUS_LOOKS[status].icon,
            label: t(`class-${status}`),
            value: status,
          }))}
          title={t("class-status")}
        />
      ),
      id: "status",
    }),
    classColumns.display({
      cell: (info) => (
        <WithAction action="class.create">
          {info.row.original.status === "archived" ? (
            <SchoolClassRestore row={info.row.original} slug={slug} />
          ) : (
            <SchoolClassMenu row={info.row.original} slug={slug} />
          )}
        </WithAction>
      ),
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
        rowId={(row) => row.id}
        search="name"
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}
