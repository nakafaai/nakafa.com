import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { readsEveryClass } from "@/components/tenant/insight/access";
import { OwnPractice } from "@/components/tenant/insight/practice";
import { percentOf } from "@/components/tenant/insight/rows";
import { ClassInsightTable } from "@/components/tenant/insight/table";
import { Link } from "@/lib/routing/link";

/**
 * Insight (ADR 0035): a student reads their own standing, and a teacher reads each student's standing in a class, from
 * the exams whose results were released.
 */
export function SchoolInsight() {
  const { role } = useTenant();

  return Option.contains(role, "student") ? (
    <StudentInsight />
  ) : (
    <TeacherInsight />
  );
}

/** A student's page: their standing, and the practice they choose to share. */
function StudentInsight() {
  const t = useTranslations("SchoolInsight");

  return (
    <PageFrame width="column">
      <SchoolHeader items={[{ label: t("title") }]} />
      <LayoutContent className="flex w-full flex-col gap-4 py-6">
        <OwnInsight />
        <OwnPractice />
      </LayoutContent>
    </PageFrame>
  );
}

/** How many classes one page of a leader's class choice loads, and each page after it. */
const CLASS_PAGE_SIZE = 50;

/** Whether the viewer reads the classes of the school, once the viewer is read. */
function useLeadsSchool() {
  const viewer = useViewerQuery();
  return QueryResult.isSuccess(viewer) && readsEveryClass(viewer.value);
}

/**
 * A teacher's page: the header chooses the class, the first one from the start, so the page opens on a real reading. A
 * leader also chooses among the classes of the school they read, which load as the choice nears its end. With
 * no class, the page says what must happen first instead of offering an empty list.
 */
function TeacherInsight() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const leads = useLeadsSchool();
  const classes = useMyClasses();
  const school = usePaginatedQuery(
    insight.reads.classes,
    isSettled && leads ? { slug } : "skip",
    { initialNumItems: CLASS_PAGE_SIZE }
  );
  const [picked, setPicked] = useState<string | null>(null);
  const held = Arr.dedupeWith(
    [
      ...(QueryResult.isSuccess(classes) ? classes.value : []),
      ...school.results,
    ],
    (first, second) => first.id === second.id
  );
  const items = Arr.map(held, (klass) => ({
    label: klass.name,
    value: klass.id,
  }));
  const chosen = Option.orElse(
    Arr.findFirst(held, (klass) => klass.id === picked),
    () => Arr.head(held)
  );

  return (
    <PageFrame width="column">
      <SchoolHeader items={[{ label: t("title") }]}>
        {Option.isSome(chosen) ? (
          <Select
            items={items}
            onValueChange={(value) => setPicked(value)}
            value={chosen.value.id}
          >
            <SelectTrigger aria-label={t("class")} className="w-40 sm:w-56">
              <SelectValue placeholder={t("class")} />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(items, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
              {PaginatedQueryResult.isCanLoadMore(school) ? (
                <Intersection
                  onIntersect={() => school.loadMore(CLASS_PAGE_SIZE)}
                />
              ) : null}
            </SelectContent>
          </Select>
        ) : null}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-4 py-6">
        {Option.isSome(chosen) ? (
          <ClassInsightTable classId={chosen.value.id} />
        ) : null}
        {PaginatedQueryResult.isCanLoadMore(school) && Option.isNone(chosen) ? (
          <Intersection onIntersect={() => school.loadMore(CLASS_PAGE_SIZE)} />
        ) : null}
        {QueryResult.isSuccess(classes) &&
        Arr.isReadonlyArrayEmpty(held) &&
        (!leads || PaginatedQueryResult.isExhausted(school)) ? (
          <NoClass />
        ) : null}
      </LayoutContent>
    </PageFrame>
  );
}

/** What a viewer with no class does first: an admin opens the classrooms, and a teacher asks one. */
function NoClass() {
  const t = useTranslations("SchoolInsight");
  const { canManage, slug } = useTenant();
  const leads = useLeadsSchool();

  return (
    <TableEmpty
      act="pointing"
      action={
        canManage ? (
          <Link
            className={buttonVariants()}
            params={{ slug }}
            to="/school/$slug/settings/classes"
          >
            {t("no-class-action")}
          </Link>
        ) : undefined
      }
      description={leads ? t("no-class-description") : t("no-class-member")}
      title={t("no-class")}
    />
  );
}

/** The columns of a student's own standing. */
const skillColumns =
  tableColumns<Ref.Returns<typeof insight.reads.mine>[number]>();

/** A student's own standing in each competency, without a chance. */
function OwnInsight() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const mine = useQuery(insight.reads.mine, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(mine)) {
    throw mine.error;
  }
  if (!QueryResult.isSuccess(mine)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(mine.value)) {
    return (
      <TableEmpty
        act="waving"
        description={t("empty-description")}
        title={t("empty")}
      />
    );
  }
  return (
    <TableFiltersProvider>
      <TableFrame>
        <DataTable
          columns={[
            skillColumns.text((skill) => skill.competency, {
              cell: (info) => <span dir="auto">{info.getValue()}</span>,
              header: t("competency"),
              id: "competency",
            }),
            skillColumns.number((skill) => percentOf(skill.rating), {
              header: t("mastery"),
              id: "mastery",
            }),
            skillColumns.number((skill) => skill.earned, {
              cell: (info) =>
                t("evidence-points", {
                  earned: info.getValue(),
                  possible: info.row.original.possible,
                }),
              header: t("evidence"),
              id: "evidence",
            }),
          ]}
          data={mine.value}
          rowId={(skill) => skill.competency}
        />
      </TableFrame>
    </TableFiltersProvider>
  );
}
