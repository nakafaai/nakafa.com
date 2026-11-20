import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { Share08Icon, Target02Icon } from "@hugeicons/core-free-icons";
import insight from "@repo/backend/confect/_generated/refs/insight";
import type { ClassView } from "@repo/backend/confect/classroom/classes.spec";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
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
import { PageList } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { pageRowVariants } from "@/components/shared/page/width";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { markOf } from "@/components/tenant/classes/marks";
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
  const tCommon = useTranslations("Common");

  return (
    <Page width="page">
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")} />
      <Tabs className="min-h-0 flex-1 shrink gap-0" defaultValue="mastery">
        <TabsList aria-label={t("tabs-label")} className={pageRowVariants()}>
          <TabsTab value="mastery">
            <HugeIcons icon={Target02Icon} />
            {tCommon("mastery")}
          </TabsTab>
          <TabsTab value="practice">
            <HugeIcons icon={Share08Icon} />
            {tCommon("practice")}
          </TabsTab>
        </TabsList>
        <TabsPanel className="flex min-h-0 flex-col" value="mastery">
          <TableFiltersProvider>
            <PageList>
              <OwnMastery />
            </PageList>
          </TableFiltersProvider>
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col" value="practice">
          <TableFiltersProvider>
            <PageList>
              <OwnPractice />
            </PageList>
          </TableFiltersProvider>
        </TabsPanel>
      </Tabs>
    </Page>
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
 * The class a teacher's page reads: the one the teacher picked, or else the first they hold. They hold their own
 * classes and, as a leader, the classes of the school they read, which load a page at a time: `loadMore` reads the
 * next page while one is left. The first class is chosen once every read that decides it has answered: the viewer,
 * their own classes and, for a leader, the school's first page. Choosing earlier would show one class and then swap to
 * another. `noClass` says the reads have answered with no class to hold and none left to load.
 */
function useClassChoice() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const viewer = useViewerQuery();
  const leads = QueryResult.isSuccess(viewer) && readsEveryClass(viewer.value);
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
  const settled =
    QueryResult.isSuccess(viewer) &&
    QueryResult.isSuccess(classes) &&
    !(leads && PaginatedQueryResult.isLoadingFirstPage(school));
  const chosen = settled
    ? Option.orElse(
        Arr.findFirst(held, (klass) => klass.id === picked),
        () => Arr.head(held)
      )
    : Option.none();
  const noClass =
    settled &&
    Arr.isReadonlyArrayEmpty(held) &&
    (!leads || PaginatedQueryResult.isExhausted(school));
  const loadMore = PaginatedQueryResult.isCanLoadMore(school)
    ? Option.some(() => school.loadMore(CLASS_PAGE_SIZE))
    : Option.none();

  return { chosen, held, loadMore, noClass, pick: setPicked };
}

/**
 * The header's choice of class among the classes the teacher holds, each with its mark. A leader's list loads the
 * school's next page of classes as the choice nears its end.
 */
function ClassSelect({
  chosen,
  classes,
  loadMore,
  onPick,
}: {
  /** The ID of the class the page reads. */
  chosen: string;
  /** The classes the teacher holds, their own and the school's pages read so far. */
  classes: readonly (typeof ClassView.Type)[];
  /** Reads the school's next page of classes, while a leader has one left. */
  loadMore: Option.Option<() => void>;
  /** Keeps the class the teacher picks as the one the page reads. */
  onPick: (id: string | null) => void;
}) {
  const common = useTranslations("Common");
  const items = Arr.map(classes, (klass) => ({
    label: klass.name,
    value: klass.id,
  }));

  return (
    <ButtonGroup>
      <Select
        items={items}
        onValueChange={(value) => onPick(value)}
        value={chosen}
      >
        <SelectTrigger aria-label={common("class")} className="w-32 sm:w-56">
          <SelectValue placeholder={common("class")} />
        </SelectTrigger>
        <SelectContent label={common("menu-class")}>
          {Arr.map(items, (item) => (
            <SelectItem
              icon={
                <PersonAvatar className="size-5" mascot={markOf(item.value)} />
              }
              key={item.value}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
          {Option.isSome(loadMore) ? (
            <Intersection onIntersect={loadMore.value} />
          ) : null}
        </SelectContent>
      </Select>
    </ButtonGroup>
  );
}

/**
 * A teacher's page: the header chooses the class, the first one from the start, and holds the page's one main action,
 * naming what an exam's questions test. The body is the class's tabs. A leader also chooses among the classes of the
 * school they read, which load as the choice nears its end. With no class, the page says what must happen first
 * instead of offering an empty list.
 */
function TeacherInsight() {
  const t = useTranslations("SchoolInsight");
  const { chosen, held, loadMore, noClass, pick } = useClassChoice();

  return (
    <Page width="page">
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {Option.isSome(chosen) ? (
          <>
            <ClassSelect
              chosen={chosen.value.id}
              classes={held}
              loadMore={loadMore}
              onPick={pick}
            />
            <QuestionTags />
          </>
        ) : null}
      </SchoolHeader>
      {Option.isSome(chosen) ? (
        <ClassInsightTabs classId={chosen.value.id} />
      ) : null}
      {Option.isNone(chosen) && Option.isSome(loadMore) ? (
        <Intersection onIntersect={loadMore.value} />
      ) : null}
      {noClass ? (
        <PageList>
          <NoClass />
        </PageList>
      ) : null}
    </Page>
  );
}

/** What a viewer with no class does first: an admin opens the classrooms, and a teacher asks one. */
function NoClass() {
  const t = useTranslations("SchoolInsight");
  const tCommon = useTranslations("Common");
  const { canManage, slug } = useTenant();
  const leads = useLeadsSchool();

  return (
    <EmptyState
      action={
        canManage ? (
          <Link
            className={buttonVariants()}
            params={{ slug }}
            to="/school/$slug/settings/classes"
          >
            {tCommon("open-classrooms")}
          </Link>
        ) : undefined
      }
      description={leads ? t("no-class-description") : t("no-class-member")}
      scene={<EmptyNina act="charting" />}
      title={t("no-class")}
    />
  );
}
