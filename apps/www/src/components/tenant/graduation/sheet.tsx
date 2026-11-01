import type { Ref } from "@confect/core";
import { usePaginatedQuery } from "@confect/react";
import {
  Certificate01Icon,
  CheckmarkBadge01Icon,
  CircleIcon,
  Download04Icon,
  IdentityCardIcon,
  MoreHorizontalIcon,
  SquareLock02Icon,
  UserCheck01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PaneOpen } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { TablePages } from "@/components/shared/table/pages";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableText } from "@/components/shared/table/text";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { GraduationLineDetail } from "@/components/tenant/graduation/detail";
import {
  CohortGraduationHeader,
  useCohortArgs,
} from "@/components/tenant/graduation/header";
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
 * average, whether a NISN is on file, their SKL, and what keeps them from it, beside the student
 * a press opens on a wide screen and in a sheet on a phone. The header holds the search, the
 * decision on graduation and the issue of the letters for the principal, and the e-Ijazah export.
 */
export function CohortGraduation() {
  return (
    <TableFiltersProvider>
      <PanesProvider>
        <CohortGraduationHeader />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <CohortGraduationBody />
        </div>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/** The students of the class group, read a page at a time, beside the open student; or the empty state. */
function CohortGraduationBody() {
  const t = useTranslations("SchoolGraduation");
  const format = useFormatter();
  const args = useCohortArgs();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    records.graduations.sheet,
    isSettled ? args : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const twoDecimals = (value: number) =>
    format.number(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

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
      header: t("email"),
      id: "email",
    }),
    lineColumns.values((line) => (line.hasNisn ? "yes" : "no"), {
      cell: (info) => t(`nisn-${info.getValue()}`),
      header: t("nisn"),
      id: "nisn",
      options: Arr.map(["yes", "no"] as const, (value) => ({
        icon: value === "yes" ? UserCheck01Icon : IdentityCardIcon,
        label: t(`nisn-${value}`),
        value,
      })),
    }),
    lineColumns.number(averageOf, {
      cell: (info) =>
        info.getValue() === NO_AVERAGE ? (
          <span className="text-muted-foreground">{t("average-none")}</span>
        ) : (
          <span className="tabular-nums">{twoDecimals(info.getValue())}</span>
        ),
      header: t("average"),
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
        <span className="flex gap-1">
          {Arr.map(info.getValue(), (value) => (
            <TableStatus
              icon={READY_LOOKS[value].icon}
              key={value}
              label={t(`ready-${value}`)}
              tone={READY_LOOKS[value].tone}
            />
          ))}
        </span>
      ),
      header: t("ready"),
      id: "ready",
      options: Arr.map(
        ["ready", "npsn", "decision", "nisn", "report"] as const,
        (value) => ({
          icon: READY_LOOKS[value].icon,
          label: t(`ready-${value}`),
          value,
        })
      ),
    }),
    lineColumns.menu((info) => <GraduationLineMenu line={info.row.original} />),
  ];

  return (
    <Panes>
      <PanesList>
        <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
          <DataTable
            columns={columns}
            data={pagination.results}
            empty={
              <TableEmpty
                act="reading"
                description={t("students-empty-description")}
                title={t("students-empty")}
              />
            }
            rowId={(line) => line.student.id}
            search="student"
          />
        </TablePages>
      </PanesList>
      <PanesDetail label={t("detail")}>
        <GraduationLineDetail lines={pagination.results} />
      </PanesDetail>
    </Panes>
  );
}

/** The row menu of one student: open the SKL's PDF and its check page, once it is locked. */
function GraduationLineMenu({ line }: { line: GraduationLine }) {
  const t = useTranslations("SchoolGraduation");
  const common = useTranslations("Common");
  const locale = useLocale();

  if (line.letter === null || line.letter.file === null) {
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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            render={
              <a href={line.letter.file} rel="noopener" target="_blank">
                <HugeIcons icon={Download04Icon} />
                {t("open-letter")}
              </a>
            }
          />
          <DropdownMenuItem
            render={
              <a
                href={checkAddress(locale, line.letter.hash)}
                rel="noopener"
                target="_blank"
              >
                <HugeIcons icon={CheckmarkBadge01Icon} />
                {t("open-check")}
              </a>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
