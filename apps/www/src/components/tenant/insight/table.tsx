import type { GenericId, Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  CheckmarkCircle02Icon,
  Note01Icon,
  NoteEditIcon,
  Share08Icon,
  StudentIcon,
  Target02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { pageRowVariants } from "@/components/shared/content/width";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import {
  TableEmpty,
  TableNote,
  TablePageBody,
} from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableText } from "@/components/shared/table/text";
import { TableTitle } from "@/components/shared/table/title";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import {
  NarrativeButton,
  NarrativeProvider,
} from "@/components/tenant/insight/narrative";
import { SharedPractice } from "@/components/tenant/insight/practice";
import {
  type InsightStudent,
  type NarrativeState,
  percentOf,
  skillRowsOf,
  studentRowsOf,
} from "@/components/tenant/insight/rows";
import { Link } from "@/lib/routing/link";

/** The columns of a class's students. */
const studentColumns = tableColumns<ReturnType<typeof studentRowsOf>[number]>();

/** The columns of a class's standing. */
const skillColumns = tableColumns<ReturnType<typeof skillRowsOf>[number]>();

/** The class the tabs show and what was read of it. */
interface HeldInsight {
  readonly classId: GenericId.GenericId<"classes">;
  readonly read: Ref.Returns<typeof insight.reads.ofClass>;
}

/** The look of each state of a student's narrative. */
const NARRATIVE_LOOKS = {
  none: { icon: NoteEditIcon, tone: "neutral" },
  saved: { icon: Note01Icon, tone: "info" },
  shared: { icon: CheckmarkCircle02Icon, tone: "success" },
} as const satisfies Record<typeof NarrativeState.Type, StatusLook>;

/**
 * One class as its teacher reads it, in three tabs: the class's students, each student's competencies with the points
 * behind them, and the practice students share. The tabs and the table heads stand from the first frame and the rows
 * fill in under them, and another class keeps the last one's rows until its own are read, so the body never blanks. The
 * chance of reaching the KKTP, which only a teacher sees and which never changes a grade, shows while the forecast
 * passes its monthly test (ADR 0035).
 */
export function ClassInsightTabs({
  classId,
}: {
  classId: GenericId.GenericId<"classes">;
}) {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const found = useQuery(
    insight.reads.ofClass,
    isSettled ? { classId, slug } : "skip"
  );

  const [held, setHeld] = useState<HeldInsight | null>(null);

  if (QueryResult.isFailure(found)) {
    throw found.error;
  }
  if (QueryResult.isSuccess(found) && found.value !== held?.read) {
    setHeld({ classId, read: found.value });
  }
  const isRead = held !== null;
  const students = isRead ? held.read.students : [];

  return (
    <NarrativeProvider
      classId={isRead ? held.classId : classId}
      students={students}
    >
      <Tabs className="min-h-0 flex-1 shrink gap-0" defaultValue="students">
        <TabsList aria-label={t("tabs-label")} className={pageRowVariants()}>
          <TabsTab value="students">
            <HugeIcons icon={UserGroupIcon} />
            {t("tab-students")}
          </TabsTab>
          <TabsTab value="mastery">
            <HugeIcons icon={Target02Icon} />
            {t("mastery")}
          </TabsTab>
          <TabsTab value="practice">
            <HugeIcons icon={Share08Icon} />
            {t("tab-practice")}
          </TabsTab>
        </TabsList>
        <TabsPanel className="flex min-h-0 flex-col" value="students">
          <TableFiltersProvider>
            <TablePageBody>
              <ClassStudents isRead={isRead} students={students} />
            </TablePageBody>
          </TableFiltersProvider>
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col" value="mastery">
          <TableFiltersProvider>
            <TablePageBody>
              <DataTable
                columns={[
                  skillColumns.text((row) => row.student, {
                    cell: (info) => (
                      <TableTitle icon={StudentIcon}>
                        <span dir="auto">{info.getValue()}</span>
                      </TableTitle>
                    ),
                    header: t("student"),
                    id: "student",
                  }),
                  skillColumns.text((row) => row.competency, {
                    cell: (info) => <TableText>{info.getValue()}</TableText>,
                    header: t("competency"),
                    id: "competency",
                  }),
                  skillColumns.number((row) => percentOf(row.rating), {
                    header: t("mastery"),
                    id: "mastery",
                  }),
                  skillColumns.number((row) => row.earned, {
                    cell: (info) =>
                      t("evidence-points", {
                        earned: info.getValue(),
                        possible: info.row.original.possible,
                      }),
                    header: t("evidence"),
                    id: "evidence",
                  }),
                  ...(isRead && held.read.forecasts
                    ? [
                        skillColumns.number(
                          (row) =>
                            row.chance === null ? null : percentOf(row.chance),
                          {
                            header: t("chance", { kktp: held.read.kktp }),
                            id: "chance",
                          }
                        ),
                      ]
                    : []),
                  skillColumns.menu((info) => (
                    <NarrativeButton id={info.row.original.studentId} />
                  )),
                ]}
                data={skillRowsOf(students)}
                empty={
                  <TableEmpty
                    act="pointing"
                    action={
                      <Link
                        className={buttonVariants()}
                        params={{ slug }}
                        to="/school/$slug/exams"
                      >
                        {t("exams-action")}
                      </Link>
                    }
                    description={t("class-empty-description")}
                    title={t("class-empty")}
                  />
                }
                loading={!isRead}
                rowId={(row) => row.key}
              />
              {isRead &&
              Arr.isReadonlyArrayNonEmpty(skillRowsOf(students)) ? (
                <TableNote>
                  {held.read.forecasts ? t("chance-note") : t("chance-held")}
                </TableNote>
              ) : null}
            </TablePageBody>
          </TableFiltersProvider>
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col" value="practice">
          <TableFiltersProvider>
            <TablePageBody>
              <SharedPractice isRead={isRead} students={students} />
            </TablePageBody>
          </TableFiltersProvider>
        </TabsPanel>
      </Tabs>
    </NarrativeProvider>
  );
}

/**
 * The class's students, one row each: their email, how many competencies they have points in, their mean mastery, and
 * where their narrative stands, with the narrative one press from the row.
 */
function ClassStudents({
  isRead,
  students,
}: {
  isRead: boolean;
  students: readonly InsightStudent[];
}) {
  const t = useTranslations("SchoolInsight");
  const { canManage, slug } = useTenant();

  return (
    <>
      <DataTable
        columns={[
          studentColumns.text((row) => row.name, {
            cell: (info) => (
              <TableTitle icon={StudentIcon}>
                <span dir="auto">{info.getValue()}</span>
              </TableTitle>
            ),
            header: t("student"),
            id: "student",
          }),
          studentColumns.text((row) => row.email ?? "", {
            cell: (info) => <TableText>{info.getValue()}</TableText>,
            header: t("email"),
            id: "email",
          }),
          studentColumns.number((row) => row.competencies, {
            header: t("competencies-count"),
            id: "competencies",
          }),
          studentColumns.number((row) => row.mastery, {
            header: t("mastery"),
            id: "mastery",
          }),
          studentColumns.values((row) => row.state, {
            cell: (info) => (
              <TableStatus
                {...NARRATIVE_LOOKS[info.row.original.state]}
                label={t(`narrative-${info.row.original.state}`)}
              />
            ),
            header: t("narrative"),
            id: "narrative",
            options: [
              {
                icon: NoteEditIcon,
                label: t("narrative-none"),
                value: "none",
              },
              {
                icon: Note01Icon,
                label: t("narrative-saved"),
                value: "saved",
              },
              {
                icon: CheckmarkCircle02Icon,
                label: t("narrative-shared"),
                value: "shared",
              },
            ],
          }),
          studentColumns.menu((info) => (
            <NarrativeButton id={info.row.original.id} />
          )),
        ]}
        data={studentRowsOf(students)}
        empty={
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
            description={t("students-empty-description")}
            title={t("students-empty")}
          />
        }
        loading={!isRead}
        rowId={(row) => row.id}
      />
      {Arr.isReadonlyArrayEmpty(students) ? null : (
        <TableNote>{t("narratives-note")}</TableNote>
      )}
    </>
  );
}
