import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
} from "@confect/react";
import { MoreHorizontalIcon, SentIcon } from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import {
  GradeValue,
  type GradingScheme,
} from "@repo/backend/confect/records/scheme";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Number as Num, Option, Schema } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useState,
  useTransition,
} from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  enterChange,
  releaseChange,
  type SheetLine,
} from "@/components/tenant/grades/change";
import { saveSchool } from "@/components/tenant/settings/save";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import type { readClassGradesFn } from "@/lib/tenant/grades.functions";

const SOURCE = "components/tenant/grades/sheet";

/** How many students one page of the gradebook loads, and each page after it. */
export const GRADEBOOK_PAGE_SIZE = 50;

/** The states a line's grade is in, as the state filter offers them. */
const LINE_STATES = ["none", "draft", "released"] as const;

/** The columns of the gradebook. */
const lineColumns = createColumnHelper<typeof dataTableFeatures, SheetLine>();

/** Whether a typed text is a grade value the scheme accepts. */
const decodeValue = Schema.decodeOption(GradeValue);

/** The first screen of the gradebook, which the page's loader read on the server. */
type GradesPreload = Pick<
  Awaited<ReturnType<typeof readClassGradesFn>>,
  "scheme" | "sheet"
>;

/** The loader's first screen of the gradebook, which its reads take their first values from. */
const GradesPreloadContext = createContext<GradesPreload | undefined>(
  undefined
);

/** Provides the loader's first screen to the gradebook that the class shell renders. */
export function GradebookPreload({
  children,
  value,
}: {
  children: ReactNode;
  value: GradesPreload | undefined;
}) {
  return <GradesPreloadContext value={value}>{children}</GradesPreloadContext>;
}

/** The class, the school, and the scheme of the next entry, which every cell of the gradebook reads. */
const GradebookContext = createContext<
  | {
      readonly classId: Id<"classes">;
      readonly scheme: GradingScheme;
      readonly slug: TenantSlug;
    }
  | undefined
>(undefined);

/** The gradebook's context, which its provider always holds. */
function useGradebook() {
  const value = use(GradebookContext);
  if (value === undefined) {
    throw new Error("A gradebook cell renders outside ClassGradebook.");
  }
  return value;
}

/**
 * The gradebook of one class (ADR 0033, S2): every student of the class's cohort with the
 * grade they hold. A subject teacher types a value, which saves as the draft when the field
 * loses focus or Enter is pressed, and releases a draft from the row's menu, which shows it
 * to the student. A released grade stays as it is.
 */
export function ClassGradebook({
  classId,
  slug,
}: {
  classId: Id<"classes">;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGrades");
  const preload = use(GradesPreloadContext);
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const args = isSettled ? { classId, slug } : "skip";
  const scheme = usePreloadedQueryResult(
    records.grades.scheme,
    args,
    preload?.scheme
  );
  const pagination = usePaginatedPreloaded(
    records.grades.sheet,
    args,
    { initialNumItems: GRADEBOOK_PAGE_SIZE },
    Option.fromUndefinedOr(preload?.sheet)
  );

  if (QueryResult.isFailure(scheme)) {
    throw scheme.error;
  }
  if (!QueryResult.isSuccess(scheme) || pagination._tag === "LoadingFirstPage") {
    return null;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return failed ? (
      <DataFailure onRetry={reloadPage} />
    ) : (
      <TableEmpty
        act="reading"
        description={t("empty-description")}
        title={t("empty")}
      />
    );
  }

  const columns = lineColumns.columns([
    lineColumns.accessor((line) => line.student.name, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      filterFn: "includesString",
      header: t("student"),
      id: "student",
      sortFn: "text",
    }),
    lineColumns.display({
      cell: (info) => <GradeValueField line={info.row.original} />,
      header: t("value"),
      id: "value",
    }),
    lineColumns.accessor(
      (line) =>
        line.grade === null
          ? ""
          : (line.grade.band ?? t(`kktp-${line.grade.kktp}`)),
      { enableSorting: false, header: t("note"), id: "note" }
    ),
    lineColumns.accessor(
      (line) => (line.grade === null ? "none" : line.grade.state),
      {
        cell: (info) => t(`state-${info.getValue()}`),
        enableSorting: false,
        filterFn: "oneOf",
        header: t("state"),
        id: "state",
      }
    ),
    lineColumns.display({
      cell: (info) => <GradeLineMenu line={info.row.original} />,
      id: "actions",
    }),
  ]);

  return (
    <GradebookContext value={{ classId, scheme: scheme.value, slug }}>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        facets={[
          {
            column: "state",
            options: Arr.map(LINE_STATES, (state) => ({
              label: t(`state-${state}`),
              value: state,
            })),
            title: t("state"),
          },
        ]}
        rowId={(line) => line.student.id}
        search={{ column: "student", placeholder: t("search") }}
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(GRADEBOOK_PAGE_SIZE)} />
      ) : null}
    </GradebookContext>
  );
}

/**
 * The value of one line. A typed value saves as the draft when the field loses focus, and
 * shows at once; a value the scheme does not accept goes back to the saved one. A released
 * grade reads only.
 */
function GradeValueField({ line }: { line: SheetLine }) {
  const t = useTranslations("SchoolGrades");
  const { classId, scheme, slug } = useGradebook();
  const enter = useMutation(records.grades.enter).withOptimisticUpdate(
    enterChange(scheme)
  );
  const [, startTransition] = useTransition();
  const [typed, setTyped] = useState<string | undefined>(undefined);
  const saved = line.grade === null ? "" : String(line.grade.value);

  const save = () => {
    if (typed === undefined) {
      return;
    }
    const value = Option.flatMap(Num.parse(typed), decodeValue);
    setTyped(undefined);
    if (Option.isNone(value) || String(value.value) === saved) {
      return;
    }
    startTransition(() =>
      saveSchool(
        () =>
          enter({
            classId,
            personId: line.student.id,
            slug,
            value: value.value,
          }),
        SOURCE
      )
    );
  };

  return (
    <Input
      aria-label={t("value-label", { name: line.student.name })}
      className="w-20 tabular-nums"
      disabled={line.grade?.state === "released"}
      inputMode="decimal"
      onBlur={save}
      onChange={(event) => setTyped(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      value={typed ?? saved}
    />
  );
}

/** The row menu of a draft: release it, which shows it to its student. Other lines have no menu. */
function GradeLineMenu({ line }: { line: SheetLine }) {
  const t = useTranslations("SchoolGrades");
  const common = useTranslations("Common");
  const { classId, slug } = useGradebook();
  const release = useMutation(records.grades.release).withOptimisticUpdate(
    releaseChange(classId, line.student.id)
  );
  const [, startTransition] = useTransition();
  const { grade } = line;
  if (grade === null || grade.state !== "draft") {
    return null;
  }
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
            onClick={() =>
              startTransition(() =>
                saveSchool(() => release({ gradeId: grade.id, slug }), SOURCE)
              )
            }
          >
            <HugeIcons icon={SentIcon} />
            {t("release")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
