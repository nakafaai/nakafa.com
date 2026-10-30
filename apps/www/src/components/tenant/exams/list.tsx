import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import {
  CreateExam,
  ExamDraftsProvider,
} from "@/components/tenant/exams/dialog";
import { createExamDrafts } from "@/components/tenant/exams/drafts";
import type { ExamSummary } from "@/components/tenant/exams/optimistic";
import { SchoolHeader } from "@/components/tenant/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { Link } from "@/lib/routing/link";

/** How many exams the list asks for each time its end comes into view. */
const EXAM_PAGE_SIZE = 20;

/** The columns of the exams table. */
const examColumns = createColumnHelper<typeof dataTableFeatures, ExamSummary>();

/**
 * The exams of the school, newest first, each with its title. An exam that the server has not
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
 * data table, or nothing while the first page loads. A first page that failed shows the failure alone. The
 * title links to its editor, and the row menu to the exam's rooms. An exam that the server is still saving
 * shows its title without a link and no menu, so it is inert.
 */
function ExamListRows({
  exams: rows,
  failed,
  loadingFirst,
  saving,
}: {
  exams: readonly ExamSummary[];
  failed: boolean;
  loadingFirst: boolean;
  saving: readonly ExamSummary["id"][];
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();

  if (loadingFirst) {
    return null;
  }
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
    examColumns.display({
      cell: (info) =>
        Arr.contains(saving, info.row.original.id) ? null : (
          <ExamRoomsLink exam={info.row.original} />
        ),
      header: t("rooms-title"),
      id: "rooms",
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
 * An exam's way to its rooms, in its own column: the title already opens the editor, so the rooms
 * stay one click away instead of behind a menu.
 */
function ExamRoomsLink({ exam }: { exam: ExamSummary }) {
  const t = useTranslations("Exams");
  const { slug } = useTenant();

  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      params={{ exam: exam.id, slug }}
      to="/school/$slug/exams/$exam"
    >
      <HugeIcons icon={Calendar03Icon} />
      {t("rooms-title")}
    </Link>
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
