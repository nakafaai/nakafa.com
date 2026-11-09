import { TaskEdit01Icon } from "@hugeicons/core-free-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TablePageBody } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableTitle } from "@/components/shared/table/title";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";

/** The clock the demo's deadlines are printed by, so the page reads the same wherever it is opened. */
const DEMO_ZONE = "Asia/Jakarta";

/** The class's tasks, the soonest deadline first, as its table lists them: the key of each title, and how many of the class's 30 handed it in. */
const DEMO_TASKS = [
  {
    deadline: DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-11-13T05:00:00Z")
    ),
    handedIn: 24,
    title: "title",
  },
  {
    deadline: DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-11-17T02:00:00Z")
    ),
    handedIn: 18,
    title: "lab",
  },
  {
    deadline: DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-11-20T01:00:00Z")
    ),
    handedIn: 9,
    title: "quiz",
  },
  {
    deadline: DateTime.toEpochMillis(
      DateTime.makeUnsafe("2026-11-27T10:00:00Z")
    ),
    handedIn: 2,
    title: "essay",
  },
] as const;

/** One task of the demo's table. */
type DemoTask = (typeof DEMO_TASKS)[number];

/** The columns of the demo's task table. */
const taskColumns = tableColumns<DemoTask>();

/**
 * The columns of the class's task table that fit the page's middle, as a teacher reads them: each
 * task's title, its deadline, how many handed it in, and the row's menu. Every head filters its column, as it does in
 * the School.
 */
function useDemoColumns() {
  const t = useTranslations("SchoolSite");
  const format = useFormatter();

  return [
    taskColumns.text((task) => t(`demo-task-${task.title}`), {
      cell: (info) => (
        <TableTitle icon={TaskEdit01Icon}>{info.getValue()}</TableTitle>
      ),
      header: t("demo-head-title"),
      id: "title",
    }),
    taskColumns.days((task) => task.deadline, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(info.getValue(), "date", { timeZone: DEMO_ZONE })}
        </span>
      ),
      header: t("demo-head-deadline"),
      id: "deadline",
      timeZone: () => DEMO_ZONE,
    }),
    taskColumns.number((task) => task.handedIn, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {t("demo-task-handed", { done: info.getValue(), total: 30 })}
        </span>
      ),
      header: t("demo-head-status"),
      id: "handedIn",
    }),
    taskColumns.menu((info) => (
      <RowCopy value={t(`demo-task-${info.row.original.title}`)} />
    )),
  ];
}

/**
 * The tasks part: a class's tasks in the School's own task table, the soonest deadline first, with
 * how many handed each one in. Its heads filter the rows, and each row's menu copies its title.
 */
export function SchoolTasks() {
  const columns = useDemoColumns();

  return (
    <FeatureRow id="tasks" layout="end">
      <SchoolFeatureText feature="tasks">
        <Nina act="writing" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <TableFiltersProvider>
          <TablePageBody>
            <DataTable
              columns={columns}
              data={DEMO_TASKS}
              rowId={(task) => task.title}
            />
          </TablePageBody>
        </TableFiltersProvider>
      </FeatureProduct>
    </FeatureRow>
  );
}
