import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { Calendar03Icon, TaskEdit01Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, DateTime, Option } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { RowItems, RowOpen } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { TableTitle } from "@/components/shared/table/title";
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
const examColumns = tableColumns<ListedExam>();

/**
 * The exams of the school, newest first, each with its title, its unit, its questions and its day. An exam that the
 * server has not
 * saved yet is disabled until it answers. The next page loads when the end of the list comes
 * into view, so the list has no button. The header holds the search and the page's one create action, shown when
 * the viewer can create an exam in at least one place, from the first paint and final, so it never changes: Create's
 * dialog waits while the first page loads, and an empty school's list says so under it. An exam that is still saving does
 * not end the empty state. A failed read of the list shows its own sentence and a retry, and a viewer who lost the
 * school's access is sent to the refused page.
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

  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  return (
    <ExamDraftsProvider drafts={drafts}>
      <TableFiltersProvider>
        <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
          <TableSearch placeholder={t("exams-search")} />
          {tenant.home.canCreate ? (
            <CreateExam
              choices={tenant.home.choices}
              slug={slug}
              waiting={PaginatedQueryResult.isLoadingFirstPage(pagination)}
            />
          ) : null}
        </SchoolHeader>
        <TablePageBody>
          <TablePages pageSize={EXAM_PAGE_SIZE} pagination={pagination}>
            <ExamListRows exams={pagination.results} saving={saving} />
          </TablePages>
        </TablePageBody>
      </TableFiltersProvider>
    </ExamDraftsProvider>
  );
}

/**
 * The rows of the exam list: the failure of its read above the rows it already holds, and the exams in a
 * data table, or nothing while the first page loads. A first page that failed shows the failure alone. Each
 * row shows where the exam belongs, how many questions it holds and when it was created. The title links to its
 * editor, and the row menu opens its editor, its rooms, the exam as a student sees it, and Delete. A viewer who may
 * only open the exam's rooms, such as a Proctor, follows the title to the rooms, and the menu offers the same. An exam
 * that the server is still saving shows its title without a link and its menu stays inert.
 */
function ExamListRows({
  exams: rows,
  saving,
}: {
  exams: readonly ListedExam[];
  saving: readonly ListedExam["id"][];
}) {
  const t = useTranslations("Exams");
  const formatZone = useFormatTimeZone();
  const format = useFormatter();
  const tenant = useTenant();
  const viewer = useViewerQuery();

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

  const columns = [
    examColumns.text((exam) => exam.title, {
      cell: (info) => (
        <TableTitle
          icon={TaskEdit01Icon}
          tone={info.row.original.questionCount === 0 ? "warning" : "neutral"}
        >
          {Arr.contains(saving, info.row.original.id) ? (
            <span className="text-muted-foreground" dir="auto">
              {info.getValue()}
            </span>
          ) : (
            <Link
              className="underline-offset-4 hover:underline"
              dir="auto"
              params={{ exam: info.row.original.id, slug: tenant.slug }}
              to={
                info.row.original.canEdit
                  ? "/school/$slug/exams/$exam/edit"
                  : "/school/$slug/exams/$exam"
              }
            >
              {info.getValue()}
            </Link>
          )}
        </TableTitle>
      ),
      header: t("title-label"),
      id: "title",
    }),
    examColumns.values((exam) => placeOf(exam.scope), {
      cell: (info) => <span dir="auto">{placeName(info.getValue())}</span>,
      header: t("unit"),
      id: "unit",
      options: Arr.zipWith(
        places,
        namedOptions(places, UNIT_ICONS),
        (place, option) => ({
          icon: option.icon,
          label: placeName(place),
          value: place,
        })
      ),
    }),
    examColumns.number((exam) => exam.questionCount, {
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      header: t("questions-column"),
      id: "questions",
    }),
    examColumns.days((exam) => exam.createdAt, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium" }
          )}
        </span>
      ),
      header: t("created-column"),
      id: "created",
      timeZone: formatZone,
    }),
    examColumns.menu(
      (info) =>
        Arr.contains(saving, info.row.original.id) ||
        !info.row.original.canEdit ? (
          <RowItems>
            <RowOpen icon={Calendar03Icon} label={t("rooms-title")} />
          </RowItems>
        ) : (
          <ExamRowMenu exam={info.row.original} />
        ),
      { inert: (row) => Arr.contains(saving, row.id) }
    ),
  ];

  return (
    <DataTable
      columns={columns}
      // A school whose only exams are still saving has none yet: the empty state keeps its action.
      data={
        Arr.every(rows, (exam) => Arr.contains(saving, exam.id)) ? [] : rows
      }
      empty={<NoExamEmpty />}
      rowId={(exam) => exam.id}
      search="title"
    />
  );
}

/**
 * The empty state of the exam list. A viewer who only opens rooms reads where exams come in. A viewer who can create an exam reads that there is none yet, with Nina writing,
 * under the header's Create exam. A viewer with no unit to create an exam in is told why and where it is fixed: a
 * manager goes to the units, and anyone else is told to ask an admin.
 */
function NoExamEmpty() {
  const tenant = useTenant();
  const t = useTranslations("Exams");

  if (!tenant.canOpenExams) {
    return (
      <TableEmpty
        act="waving"
        description={t("rooms-list-description")}
        title={t("empty")}
      />
    );
  }
  if (tenant.home.canCreate) {
    return (
      <TableEmpty
        act="writing"
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
