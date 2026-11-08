import {
  CheckmarkCircle02Icon,
  Note01Icon,
  NoteEditIcon,
  StudentIcon,
} from "@hugeicons/core-free-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { useTranslations } from "use-intl";
import { SchoolFeatureText } from "@/components/marketing/school/features/text";
import {
  FeatureProduct,
  FeatureRow,
} from "@/components/marketing/shared/feature";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TablePageBody } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";

/** The look of each state of a student's narrative, as the class's insight table draws it. */
const NARRATIVE_LOOKS = {
  none: { icon: NoteEditIcon, tone: "neutral" },
  saved: { icon: Note01Icon, tone: "info" },
  shared: { icon: CheckmarkCircle02Icon, tone: "success" },
} as const satisfies Record<string, StatusLook>;

/** The students of one class as insight reads them: the skills measured, the mastery over them, and where the teacher's narrative stands. */
const DEMO_STUDENTS = [
  { mastery: 58, name: "Bima", narrative: "none", skills: 12 },
  { mastery: 61, name: "Citra", narrative: "saved", skills: 12 },
  { mastery: 79, name: "Raka", narrative: "saved", skills: 12 },
  { mastery: 84, name: "Nadia", narrative: "shared", skills: 12 },
  { mastery: 91, name: "Fajar", narrative: "shared", skills: 12 },
] as const;

/** One student of the demo's table. */
type DemoStudent = (typeof DEMO_STUDENTS)[number];

/** The columns of the demo's student table. */
const studentColumns = tableColumns<DemoStudent>();

/**
 * The columns of the class's student table, as its teacher reads it in insight: each student, the
 * skills measured, the mastery over them, where the narrative stands, and the row's menu. Every head
 * filters its column, so the teacher finds the lowest mastery first.
 */
function useDemoColumns() {
  const t = useTranslations("SchoolSite");

  return [
    studentColumns.text((row) => row.name, {
      cell: (info) => (
        <TableTitle icon={StudentIcon}>{info.getValue()}</TableTitle>
      ),
      header: t("demo-head-student"),
      id: "student",
    }),
    studentColumns.number((row) => row.skills, {
      header: t("demo-head-skills"),
      id: "skills",
    }),
    studentColumns.number((row) => row.mastery, {
      header: t("demo-head-mastery"),
      id: "mastery",
    }),
    studentColumns.values((row) => row.narrative, {
      cell: (info) => (
        <TableStatus
          {...NARRATIVE_LOOKS[info.row.original.narrative]}
          label={t(`demo-narrative-${info.row.original.narrative}`)}
        />
      ),
      header: t("demo-head-narrative"),
      id: "narrative",
      options: [
        {
          icon: NoteEditIcon,
          label: t("demo-narrative-none"),
          value: "none",
        },
        {
          icon: Note01Icon,
          label: t("demo-narrative-saved"),
          value: "saved",
        },
        {
          icon: CheckmarkCircle02Icon,
          label: t("demo-narrative-shared"),
          value: "shared",
        },
      ],
    }),
    studentColumns.menu((info) => <RowCopy value={info.row.original.name} />),
  ];
}

/**
 * The insight part: one class's students in the School's own insight table, with the mastery that
 * shows who needs help and where each narrative stands, before any report is due.
 */
export function SchoolInsight() {
  const columns = useDemoColumns();

  return (
    <FeatureRow id="insight">
      <SchoolFeatureText feature="insight">
        <Nina act="searching" label="" size={88} whole />
      </SchoolFeatureText>
      <FeatureProduct>
        <TableFiltersProvider>
          <TablePageBody>
            <DataTable
              columns={columns}
              data={DEMO_STUDENTS}
              rowId={(row) => row.name}
            />
          </TablePageBody>
        </TableFiltersProvider>
      </FeatureProduct>
    </FeatureRow>
  );
}
