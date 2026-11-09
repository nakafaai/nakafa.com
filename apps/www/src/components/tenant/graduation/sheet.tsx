import type { Ref } from "@confect/core";
import { QueryResult, usePaginatedQuery } from "@confect/react";
import {
  Certificate01Icon,
  CheckmarkBadge01Icon,
  CircleIcon,
  Download04Icon,
  IdentityCardIcon,
  SquareLock02Icon,
  UserCheck01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { Array as Arr } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { PaneOpen } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TablePageBody } from "@/components/shared/table/frame";
import { TableList } from "@/components/shared/table/list";
import { RowCopy, RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableText } from "@/components/shared/table/text";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { LoadFailure } from "@/components/state/failure";
import { EmptyNina } from "@/components/state/nina";
import { GraduationLineDetail } from "@/components/tenant/graduation/detail";
import { GraduationElsewhere } from "@/components/tenant/graduation/elsewhere";
import {
  CohortGraduationHeader,
  useCohortArgs,
  useGraduationPage,
} from "@/components/tenant/graduation/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { checkAddress } from "@/components/tenant/reports/check";

/** One student of a graduating class group, as the page reads them. */
export type GraduationLine = Ref.Returns<
  typeof records.graduations.sheet
>["page"][number];

/** How many students one page of the list loads, and each page after it. */
const PAGE_SIZE = 50;

/** The look of each readiness value: ready, or the fact that is missing, which reads as a warning. */
const READY_LOOKS = {
  decision: { icon: CheckmarkBadge01Icon, tone: "warning" },
  nisn: { icon: IdentityCardIcon, tone: "warning" },
  npsn: { icon: IdentityCardIcon, tone: "warning" },
  ready: { icon: UserCheck01Icon, tone: "success" },
  report: { icon: UserRemove01Icon, tone: "warning" },
} as const satisfies Record<
  GraduationLine["missing"][number] | "ready",
  StatusLook
>;

/** The readiness values of a line: what is missing, or ready when nothing is. */
const readinessOf = (line: GraduationLine) =>
  Arr.isReadonlyArrayEmpty(line.missing) ? ["ready" as const] : line.missing;

/** The state of a line's SKL: none yet, or the state it is in. */
const letterStateOf = (line: GraduationLine) => line.letter?.state ?? "none";

/** The state of a line's SKL with its look, in the list and its filter. */
const LETTER_LOOKS = {
  issued: { icon: Certificate01Icon, tone: "info" },
  locked: { icon: SquareLock02Icon, tone: "success" },
  none: { icon: CircleIcon, tone: "neutral" },
} as const satisfies Record<ReturnType<typeof letterStateOf>, StatusLook>;

/** The sort value of a student without transcript data: below every average, which is 0 or more. */
const NO_AVERAGE = -1;

/** A line's transcript average, which its column sorts by. */
const averageOf = (line: GraduationLine) =>
  line.transcript?.average ?? NO_AVERAGE;

/** The columns of the graduation list. */
const lineColumns = tableColumns<GraduationLine>();

/**
 * The graduation of one class group (ADR 0033, S6): each placed student with their transcript
 * average, their SKL, and what keeps them from it, a missing NISN included, beside the student
 * a press opens on a wide screen and in a sheet on a phone. The header holds the search, the
 * decision on graduation and the issue of the letters for the principal, and the e-Ijazah export.
 * A class group outside its unit's last grade says so in the list's card, with the way back to
 * the graduating class groups.
 */
export function CohortGraduation() {
  return (
    <TableFiltersProvider>
      <PanesProvider>
        <CohortGraduationHeader />
        <CohortGraduationBody />
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/**
 * The body once the class group is read: its students for a graduating class group, or why it
 * does not graduate. The card stands from the first frame, empty until the class group is read,
 * and a read that failed says so in it.
 */
function CohortGraduationBody() {
  const page = useGraduationPage();

  if (QueryResult.isFailure(page) && isLostAccess(page.error)) {
    throw page.error;
  }
  if (QueryResult.isSuccess(page) && page.value._tag === "Graduating") {
    return <GraduationStudents />;
  }
  return (
    <TablePageBody>
      {QueryResult.isFailure(page) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      {QueryResult.isSuccess(page) && page.value._tag === "NotGraduating" ? (
        <GraduationElsewhere page={page.value} />
      ) : null}
    </TablePageBody>
  );
}

/** The students of a graduating class group, read a page at a time, beside the open student; or the empty state. */
function GraduationStudents() {
  const t = useTranslations("SchoolGraduation");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const args = useCohortArgs();
  const pagination = usePaginatedQuery(records.graduations.sheet, args, {
    initialNumItems: PAGE_SIZE,
  });

  const twoDecimals = (value: number) => format.number(value, "score");

  const columns = [
    lineColumns.text((line) => line.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.student.id}>{info.getValue()}</PaneOpen>
      ),
      header: t("student"),
      id: "student",
    }),
    lineColumns.text((line) => line.student.email ?? "", {
      cell: (info) => <TableText>{info.getValue()}</TableText>,
      header: tCommon("email"),
      id: "email",
    }),
    lineColumns.number(averageOf, {
      cell: (info) =>
        info.getValue() === NO_AVERAGE ? (
          <span className="text-muted-foreground">{t("average-none")}</span>
        ) : (
          <span className="tabular-nums">{twoDecimals(info.getValue())}</span>
        ),
      header: tCommon("average"),
      id: "average",
    }),
    lineColumns.values(letterStateOf, {
      cell: (info) => (
        <TableStatus
          {...LETTER_LOOKS[info.getValue()]}
          label={t(`letter-${info.getValue()}`)}
        />
      ),
      header: t("letter"),
      id: "letter",
      options: Arr.map(["none", "issued", "locked"] as const, (state) => ({
        icon: LETTER_LOOKS[state].icon,
        label: t(`letter-${state}`),
        value: state,
      })),
    }),
    lineColumns.list(readinessOf, {
      cell: (info) => (
        <TableList items={info.getValue()}>
          {(value) => (
            <TableStatus
              icon={READY_LOOKS[value].icon}
              label={t(`ready-label.${value}`)}
              tone={READY_LOOKS[value].tone}
            />
          )}
        </TableList>
      ),
      header: t("ready"),
      id: "ready",
      options: Arr.map(
        ["ready", "npsn", "decision", "nisn", "report"] as const,
        (value) => ({
          icon: READY_LOOKS[value].icon,
          label: t(`ready-label.${value}`),
          value,
        })
      ),
    }),
    lineColumns.menu((info) => <GraduationLineMenu line={info.row.original} />),
  ];

  return (
    <Panes id="graduation">
      <PanesList>
        <TablePageBody>
          <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
            <DataTable
              columns={columns}
              data={pagination.results}
              empty={<GraduationStudentsEmpty />}
              rowId={(line) => line.student.id}
              search="student"
            />
          </TablePages>
        </TablePageBody>
      </PanesList>
      <PanesDetail label={t("detail")}>
        <GraduationLineDetail lines={pagination.results} />
      </PanesDetail>
    </Panes>
  );
}

/** The graduation table with no student yet, under its column heads. */
function GraduationStudentsEmpty() {
  const t = useTranslations("SchoolGraduation");

  return (
    <EmptyState
      description={t("students-empty-description")}
      scene={<EmptyNina act="reading" />}
      title={t("students-empty")}
    />
  );
}

/** The row menu of one student: open the SKL's PDF and its check page, once it is locked. */
function GraduationLineMenu({ line }: { line: GraduationLine }) {
  const t = useTranslations("SchoolGraduation");
  const locale = useLocale();

  const { letter } = line;
  if (letter === null || letter.file === null) {
    return <RowCopy value={line.student.name} />;
  }
  const file = letter.file;
  const check = checkAddress(locale, letter.hash);

  return (
    <RowItems>
      <DropdownMenuItem
        icon={Download04Icon}
        render={({ children, ...props }) => (
          <a {...props} href={file} rel="noopener" target="_blank">
            {children}
          </a>
        )}
      >
        {t("open-letter")}
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={CheckmarkBadge01Icon}
        render={({ children, ...props }) => (
          <a {...props} href={check} rel="noopener" target="_blank">
            {children}
          </a>
        )}
      >
        {t("open-check")}
      </DropdownMenuItem>
    </RowItems>
  );
}
