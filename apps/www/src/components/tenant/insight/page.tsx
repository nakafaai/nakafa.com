import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { Share08Icon, Target02Icon } from "@hugeicons/core-free-icons";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PageFrame } from "@/components/shared/content/frame";
import { pageRowVariants } from "@/components/shared/content/width";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { readsEveryClass } from "@/components/tenant/insight/access";
import { OwnMastery } from "@/components/tenant/insight/own";
import { OwnPractice } from "@/components/tenant/insight/practice";
import { ClassInsightTabs } from "@/components/tenant/insight/table";
import { QuestionTags } from "@/components/tenant/insight/tags";
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

/** A student's page: their standing in one tab, and the practice they choose to share in the other. */
function StudentInsight() {
  const t = useTranslations("SchoolInsight");

  return (
    <PageFrame width="page">
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")} />
      <Tabs className="min-h-0 flex-1 shrink gap-0" defaultValue="mastery">
        <TabsList aria-label={t("tabs-label")} className={pageRowVariants()}>
          <TabsTab value="mastery">
            <HugeIcons icon={Target02Icon} />
            {t("mastery")}
          </TabsTab>
          <TabsTab value="practice">
            <HugeIcons icon={Share08Icon} />
            {t("tab-practice")}
          </TabsTab>
        </TabsList>
        <TabsPanel className="flex min-h-0 flex-col" value="mastery">
          <TableFiltersProvider>
            <TablePageBody>
              <OwnMastery />
            </TablePageBody>
          </TableFiltersProvider>
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col" value="practice">
          <TableFiltersProvider>
            <TablePageBody>
              <OwnPractice />
            </TablePageBody>
          </TableFiltersProvider>
        </TabsPanel>
      </Tabs>
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
 * A teacher's page: the header chooses the class, the first one from the start, and holds the page's one main action,
 * naming what an exam's questions test. The body is the class's tabs. A leader also chooses among the classes of the
 * school they read, which load as the choice nears its end. With no class, the page says what must happen first
 * instead of offering an empty list.
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
    <PageFrame width="page">
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {Option.isSome(chosen) ? (
          <>
            <Select
              items={items}
              onValueChange={(value) => setPicked(value)}
              value={chosen.value.id}
            >
              <SelectTrigger aria-label={t("class")} className="w-32 sm:w-56">
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
            <QuestionTags />
          </>
        ) : null}
      </SchoolHeader>
      {Option.isSome(chosen) ? (
        <ClassInsightTabs classId={chosen.value.id} />
      ) : null}
      {PaginatedQueryResult.isCanLoadMore(school) && Option.isNone(chosen) ? (
        <Intersection onIntersect={() => school.loadMore(CLASS_PAGE_SIZE)} />
      ) : null}
      {QueryResult.isSuccess(classes) &&
      Arr.isReadonlyArrayEmpty(held) &&
      (!leads || PaginatedQueryResult.isExhausted(school)) ? (
        <TablePageBody>
          <NoClass />
        </TablePageBody>
      ) : null}
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
