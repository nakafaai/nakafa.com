import type { Ref } from "@confect/core";
import { PaginatedQueryResult } from "@confect/react";
import {
  Calendar03Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { type StoreApi, useStore } from "zustand";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { CreateExam } from "@/components/tenant/exams/dialog";
import {
  createExamDrafts,
  type ExamDrafts,
} from "@/components/tenant/exams/drafts";
import type { ExamSummary } from "@/components/tenant/exams/optimistic";
import { SchoolHeader } from "@/components/tenant/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { Link } from "@/lib/routing/link";
import { EXAM_PAGE_SIZE } from "@/lib/tenant/exams";

/** The first page of the exam list, which its loader read on the server. */
type ExamListFirstPage = Pick<
  Ref.Returns<typeof exams.exams.list>,
  "isDone" | "page"
>;

/** The columns of the exams table. */
const examColumns = createColumnHelper<typeof dataTableFeatures, ExamSummary>();

/**
 * The exams of the school, newest first, each with its title. An exam that the server has not
 * saved yet is disabled until it answers. The next page loads when the end of the list comes
 * into view, so the list has no button. The page holds one create action, shown when the viewer
 * can create an exam in at least one place: in the school's one header beside the exams, or in
 * the empty state while the school has no saved exam (K27), so a new teacher meets one step in
 * the middle of the page. An exam that is still saving does not end the empty state, so its
 * create action stays where it was pressed until the editor opens. A failed read of the list
 * shows its own sentence and a retry, and a viewer who lost the school's access is sent to the
 * refused page.
 */
export function ExamList({
  first,
  slug,
}: {
  first: ExamListFirstPage | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();
  // The list needs the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    exams.exams.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: EXAM_PAGE_SIZE },
    Option.fromUndefinedOr(first)
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
  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {loadingFirst || empty ? null : (
          <TableSearch placeholder={t("exams-search")} />
        )}
        {tenant.home.canCreate && !(loadingFirst || empty) ? (
          <CreateExam
            choices={tenant.home.choices}
            drafts={drafts}
            slug={slug}
          />
        ) : null}
      </SchoolHeader>
      <div className="flex w-full min-w-0 flex-1 flex-col">
        {empty ? (
          <NoExamEmpty drafts={drafts} />
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
      </div>
    </TableFiltersProvider>
  );
}

/**
 * The rows of the exam list: the failure of its read above the rows it already holds, and the table,
 * or nothing while the first page loads. A first page that failed shows the failure alone.
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
  if (loadingFirst) {
    return null;
  }
  if (failed && Arr.isReadonlyArrayEmpty(rows)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <ExamTable exams={rows} saving={saving} />
    </>
  );
}

/**
 * The exams in a data table: the title links to its editor, and the last column links to the
 * exam's rooms. An exam that the server is still saving shows its title without a link and no
 * rooms link, so it is inert.
 */
function ExamTable({
  exams: rows,
  saving,
}: {
  exams: readonly ExamSummary[];
  saving: readonly ExamSummary["id"][];
}) {
  const t = useTranslations("Exams");
  const tenant = useTenant();

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
          <ExamRowMenu exam={info.row.original} />
        ),
      id: "actions",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowId={(exam) => exam.id}
      search="title"
    />
  );
}

/** An exam's row menu: its editor, and its rooms. */
function ExamRowMenu({ exam }: { exam: ExamSummary }) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const { slug } = useTenant();

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
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            render={
              <Link
                params={{ exam: exam.id, slug }}
                to="/school/$slug/exams/$exam/edit"
              />
            }
          >
            <HugeIcons icon={PencilEdit02Icon} />
            {t("edit-action")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                params={{ exam: exam.id, slug }}
                to="/school/$slug/exams/$exam"
              />
            }
          >
            <HugeIcons icon={Calendar03Icon} />
            {t("rooms-title")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * The empty state of the exam list. A viewer who can create an exam meets its one step here,
 * Create exam, with Nina writing. A viewer with no unit to create an exam in is told why and
 * where it is fixed: a manager goes to the units, and anyone else is told to ask an admin.
 */
function NoExamEmpty({ drafts }: { drafts: StoreApi<ExamDrafts> }) {
  const tenant = useTenant();
  const t = useTranslations("Exams");

  if (tenant.home.canCreate) {
    return (
      <TableEmpty
        act="writing"
        action={
          <CreateExam
            choices={tenant.home.choices}
            drafts={drafts}
            slug={tenant.slug}
          />
        }
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
