import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
} from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, DateTime, Option } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import {
  CreateExam,
  ExamDraftsProvider,
} from "@/components/tenant/exams/dialog";
import { createExamDrafts } from "@/components/tenant/exams/drafts";
import type { ListedExam } from "@/components/tenant/exams/optimistic";
import { ExamRowMenu } from "@/components/tenant/exams/row";
import { SchoolHeader } from "@/components/tenant/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { UNIT_ICONS } from "@/components/tenant/settings/scope";
import { Link } from "@/lib/routing/link";

/** How many exams the list asks for each time its end comes into view. */
const EXAM_PAGE_SIZE = 20;

/** The columns of the exams table. */
const examColumns = createColumnHelper<typeof dataTableFeatures, ListedExam>();

/**
 * The exams of the school, newest first, each with its title, its unit, its questions and its day. An exam that the
 * server has not
 * saved yet is disabled until it answers. The next page loads when the end of the list comes
 * into view, so the list has no button. The page holds one create action, shown when the viewer
 * can create an exam in at least one place: in the school's one header beside the exams, or in
 * the empty state while the school has no saved exam (K27), so a new teacher meets one step in
 * the middle of the page. While the first page loads the page holds no create action, since it
 * cannot know yet where the action goes. An exam that is still saving does not end the empty
 * state, so its create action stays where it was pressed until the editor opens. A failed read of the list
 * shows its own sentence and a retry, and a viewer who lost the school's access is sent to the
 * refused page.
 */
export function ExamList({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  // The list needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    exams.exams.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: EXAM_PAGE_SIZE }
  );
  const [drafts] = useState(createExamDrafts);
  const saving = useStore(drafts, (state) => state.ids);
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? pagination.loadMore
    : null;

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  const loadingFirst = pagination._tag === "LoadingFirstPage";
  // A school whose only exams are still saving has none yet: the empty state keeps its action.
  const empty =
    !(loadingFirst || failed) &&
    Arr.every(pagination.results, (exam) => Arr.contains(saving, exam.id));
  // Until the first page arrives the page cannot know whether search and Create belong in the
  // header or Create in the empty state, so the header holds neither: a dialog opened from the
  // header would close, and lose its title, when an empty list moved Create into the page.
  const listed = !(loadingFirst || empty);
  return (
    <ExamDraftsProvider drafts={drafts}>
      <TableFiltersProvider>
        <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
          {listed ? <TableSearch placeholder={t("exams-search")} /> : null}
          {tenant.home.canCreate && listed ? (
            <CreateExam choices={tenant.home.choices} slug={slug} />
          ) : null}
        </SchoolHeader>
        <TablePageBody>
          {empty ? (
            <NoExamEmpty />
          ) : (
            <ExamListRows
              exams={pagination.results}
              failed={failed}
              loadingFirst={loadingFirst}
              saving={saving}
            />
          )}
          {loadMore !== null && (
            <Intersection onIntersect={() => loadMore(EXAM_PAGE_SIZE)} />
          )}
        </TablePageBody>
      </TableFiltersProvider>
    </ExamDraftsProvider>
  );
}

/**
 * The rows of the exam list: the failure of its read above the rows it already holds, and the exams in a
 * data table, or nothing while the first page loads. A first page that failed shows the failure alone. Each
 * row shows where the exam belongs, how many questions it holds and when it was created. The title links to its
 * editor, and the row menu opens its editor, its rooms, the exam as a student sees it, and Delete. An exam that
 * the server is still saving shows its title without a link and no menu, so it is inert.
 */
function ExamListRows({
  exams: rows,
  failed,
  loadingFirst,
  saving,
}: {
  exams: readonly ListedExam[];
  failed: boolean;
  loadingFirst: boolean;
  saving: readonly ListedExam["id"][];
}) {
  const t = useTranslations("Exams");
  const format = useFormatter();
  const tenant = useTenant();
  const viewer = useViewerQuery();

  if (loadingFirst) {
    return null;
  }
  const units = QueryResult.isSuccess(viewer) ? viewer.value.units : [];
  // The place of an exam, as its column filters it: the whole school, or the unit by its ID.
  const placeOf = (scope: ListedExam["scope"]) =>
    scope.kind === "tenant" ? scope.kind : scope.unitId;
  const placeName = (place: string) =>
    place === "tenant"
      ? t("whole-school")
      : Option.match(
          Arr.findFirst(units, (unit) => unit.id === place),
          { onNone: () => "", onSome: (unit) => unit.name }
        );
  const places = Arr.dedupe(Arr.map(rows, (exam) => placeOf(exam.scope)));
  if (failed && Arr.isReadonlyArrayEmpty(rows)) {
    return <DataFailure onRetry={reloadPage} />;
  }

  const columns = examColumns.columns([
    examColumns.accessor((exam) => exam.title, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {Arr.contains(saving, info.row.original.id) ? (
            <span className="text-muted-foreground">{info.getValue()}</span>
          ) : (
            <Link
              className="underline-offset-4 hover:underline"
              params={{ exam: info.row.original.id, slug: tenant.slug }}
              to="/school/$slug/exams/$exam/edit"
            >
              {info.getValue()}
            </Link>
          )}
        </span>
      ),
      filterFn: "includesString",
      header: t("title-label"),
      id: "title",
      sortFn: "text",
    }),
    examColumns.accessor((exam) => placeOf(exam.scope), {
      cell: (info) => <span dir="auto">{placeName(info.getValue())}</span>,
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="unit"
          options={Arr.zipWith(
            places,
            namedOptions(places, UNIT_ICONS),
            (place, option) => ({
              icon: option.icon,
              label: placeName(place),
              value: place,
            })
          )}
          title={t("unit")}
        />
      ),
      id: "unit",
    }),
    examColumns.accessor((exam) => exam.questionCount, {
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      enableSorting: false,
      header: t("questions-column"),
      id: "questions",
      meta: { align: "end" },
    }),
    examColumns.accessor((exam) => exam.createdAt, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium" }
          )}
        </span>
      ),
      enableSorting: false,
      header: t("created-column"),
      id: "created",
      meta: { align: "end" },
    }),
    examColumns.display({
      cell: (info) =>
        Arr.contains(saving, info.row.original.id) ? null : (
          <ExamRowMenu exam={info.row.original} />
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
        data={rows}
        rowId={(exam) => exam.id}
        search="title"
      />
    </>
  );
}

/**
 * The empty state of the exam list. A viewer who can create an exam meets its one step here,
 * Create exam, with Nina writing. A viewer with no unit to create an exam in is told why and
 * where it is fixed: a manager goes to the units, and anyone else is told to ask an admin.
 */
function NoExamEmpty() {
  const tenant = useTenant();
  const t = useTranslations("Exams");

  if (tenant.home.canCreate) {
    return (
      <TableEmpty
        act="writing"
        action={<CreateExam choices={tenant.home.choices} slug={tenant.slug} />}
        description={t("create-description")}
        title={t("empty")}
      />
    );
  }
  return (
    <TableEmpty
      act="pointing"
      action={
        tenant.canManage ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ slug: tenant.slug }}
            to="/school/$slug/settings/units"
          >
            {t("no-unit-action")}
          </Link>
        ) : undefined
      }
      description={
        tenant.canManage ? t("no-unit-description") : t("no-unit-member")
      }
      title={t("empty")}
    />
  );
}
