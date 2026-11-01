import {
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  CircleIcon,
  Edit02Icon,
  PencilEdit02Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import {
  GradeValue,
  type GradingScheme,
} from "@repo/backend/confect/records/scheme";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Array as Arr, Number as Num, Option, Schema } from "effect";
import { createContext, use, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
  PaneOpen,
} from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  usePanes,
} from "@/components/shared/panes";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { RowCopy, RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableText } from "@/components/shared/table/text";
import { TableSearch } from "@/components/shared/table/toolbar";
import {
  correctChange,
  enterChange,
  releaseChange,
  type SheetLine,
} from "@/components/tenant/grades/change";
import { LineDialog } from "@/components/tenant/line";
import { GRADE_ICONS } from "@/components/tenant/settings/choices";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/grades/sheet";

/** How many students one page of the gradebook loads, and each page after it. */
const GRADEBOOK_PAGE_SIZE = 50;

/** The state of a line: no grade yet, a draft, or released. */
const stateOf = (line: SheetLine) =>
  line.grade === null ? "none" : line.grade.state;

/** The states a line's grade is in, each with its look, as the list, its filter, and the open student show them. */
const LINE_STATE_LOOKS = {
  draft: { icon: Edit02Icon, tone: "info" },
  none: { icon: CircleIcon, tone: "neutral" },
  released: { icon: SentIcon, tone: "success" },
} as const satisfies Record<ReturnType<typeof stateOf>, StatusLook>;

/** The columns of the gradebook. */
const lineColumns = tableColumns<SheetLine>();

/** Whether a typed text is a grade value the scheme accepts. */
const decodeValue = Schema.decodeOption(GradeValue);

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

/** The gradebook's search by student, in the class page's header; the note and state columns filter the lines. */
export function GradebookSearch() {
  const t = useTranslations("SchoolGrades");

  return <TableSearch placeholder={t("search")} />;
}

/**
 * The gradebook of one class (ADR 0033, S2): every student of the class's cohort with the
 * grade they hold, beside the student a press opens, on a wide screen, and in a sheet on a
 * phone. A subject teacher types a value, in the row or in the open student, which saves as
 * the draft when the field loses focus or Enter is pressed, and releases a draft from the
 * row's menu or the open student, which shows it to the student. A released grade stays as
 * it is.
 */
export function ClassGradebook({
  classId,
  slug,
}: {
  classId: Id<"classes">;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGrades");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const args = isSettled ? { classId, slug } : "skip";
  const scheme = useQuery(records.grades.scheme, args);
  const pagination = usePaginatedQuery(records.grades.sheet, args, {
    initialNumItems: GRADEBOOK_PAGE_SIZE,
  });

  if (QueryResult.isFailure(scheme)) {
    throw scheme.error;
  }
  // The rows wait for the scheme that every cell reads, under heads that need neither.
  const isRead = QueryResult.isSuccess(scheme);

  // The note of a line: the band its value reaches, or whether it reaches the KKTP, and none before a grade.
  const noteOf = (line: SheetLine) =>
    line.grade === null
      ? ""
      : (line.grade.band ?? t(`kktp-${line.grade.kktp}`));
  // The notes the Note head offers, each a loaded line holds: the scheme's bands and the KKTP in the scheme's order,
  // then any band of an earlier scheme version that a grade keeps.
  const held = Arr.filter(
    Arr.map(pagination.results, noteOf),
    (note) => note !== ""
  );
  const notes = Arr.filter(
    Arr.dedupe([
      ...Arr.map(isRead ? scheme.value.bands : [], (band) => band.label),
      t("kktp-reached"),
      t("kktp-notReached"),
      ...held,
    ]),
    (note) => Arr.contains(held, note)
  );

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
    lineColumns.number((line) => line.grade?.value ?? null, {
      cell: (info) => <GradeValueField line={info.row.original} />,
      header: t("value"),
      id: "value",
    }),
    lineColumns.values(noteOf, {
      header: t("note"),
      id: "note",
      options: namedOptions(notes, GRADE_ICONS),
    }),
    lineColumns.values(stateOf, {
      cell: (info) => (
        <TableStatus
          {...LINE_STATE_LOOKS[info.getValue()]}
          label={t(`state-${info.getValue()}`)}
        />
      ),
      header: t("state"),
      id: "state",
      options: Arr.map(["none", "draft", "released"] as const, (state) => ({
        icon: LINE_STATE_LOOKS[state].icon,
        label: t(`state-${state}`),
        value: state,
      })),
    }),
    lineColumns.menu((info) => <GradeLineMenu line={info.row.original} />),
  ];

  return (
    <GradebookContext
      value={isRead ? { classId, scheme: scheme.value, slug } : undefined}
    >
      <Panes id="grades">
        <PanesList>
          <TablePages pageSize={GRADEBOOK_PAGE_SIZE} pagination={pagination}>
            <DataTable
              columns={columns}
              data={isRead ? pagination.results : []}
              empty={
                <TableEmpty
                  act="reading"
                  description={t("empty-description")}
                  title={t("empty")}
                />
              }
              loading={!isRead}
              rowId={(line) => line.student.id}
              search="student"
            />
          </TablePages>
        </PanesList>
        <PanesDetail label={t("detail")}>
          {isRead ? <GradeLineDetail lines={pagination.results} /> : null}
        </PanesDetail>
      </Panes>
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
      placeholder={t("value-placeholder")}
      value={typed ?? saved}
    />
  );
}

/**
 * The open student: the grade field, the result the scheme judges, the state, and the
 * scheme's KKTP; a draft releases from the footer, and a released grade corrects from it. A student
 * the list no longer holds closes.
 */
function GradeLineDetail({ lines }: { lines: readonly SheetLine[] }) {
  const t = useTranslations("SchoolGrades");
  const { scheme } = useGradebook();
  const open = usePanes((state) => state.open);
  const line = Option.flatMap(open, (id) =>
    Arr.findFirst(lines, (candidate) => candidate.student.id === id)
  );

  return Option.match(line, {
    onNone: () => null,
    onSome: (found) => (
      <>
        <PaneHeader
          description={t(`state-${stateOf(found)}`)}
          title={found.student.name}
        />
        <PaneBody>
          <PaneFacts>
            <PaneFact label={t("value")}>
              <GradeValueField line={found} />
            </PaneFact>
            <PaneFact label={t("note")}>
              {found.grade === null
                ? t("state-none")
                : (found.grade.band ?? t(`kktp-${found.grade.kktp}`))}
            </PaneFact>
            <PaneFact label={t("state")}>
              <TableStatus
                {...LINE_STATE_LOOKS[stateOf(found)]}
                label={t(`state-${stateOf(found)}`)}
              />
            </PaneFact>
            <PaneFact label={t("kktp")}>
              <span className="tabular-nums">{scheme.kktp}</span>
            </PaneFact>
          </PaneFacts>
        </PaneBody>
        {found.grade?.state === "draft" ? (
          <PaneFooter>
            <GradeReleaseButton gradeId={found.grade.id} line={found} />
          </PaneFooter>
        ) : null}
        {found.grade?.state === "released" ? (
          <PaneFooter>
            <GradeCorrectButton
              gradeId={found.grade.id}
              line={found}
              value={found.grade.value}
            />
          </PaneFooter>
        ) : null}
      </>
    ),
  });
}

/** Releases one draft from the open student, which shows it to the student. */
function GradeReleaseButton({
  gradeId,
  line,
}: {
  gradeId: NonNullable<SheetLine["grade"]>["id"];
  line: SheetLine;
}) {
  const t = useTranslations("SchoolGrades");
  const { classId, slug } = useGradebook();
  const release = useMutation(records.grades.release).withOptimisticUpdate(
    releaseChange(classId, line.student.id)
  );
  const [, startTransition] = useTransition();

  return (
    <Button
      onClick={() =>
        startTransition(() =>
          saveSchool(() => release({ gradeId, slug }), SOURCE)
        )
      }
      type="button"
    >
      <HugeIcons icon={SentIcon} />
      {t("release")}
    </Button>
  );
}

/** Corrects one released grade from the open student, in a dialog that names who hears of it. */
function GradeCorrectButton({
  gradeId,
  line,
  value,
}: {
  gradeId: NonNullable<SheetLine["grade"]>["id"];
  line: SheetLine;
  value: number;
}) {
  const t = useTranslations("SchoolGrades");
  const { classId, slug } = useGradebook();
  const correct = useMutation(records.grades.correct).withOptimisticUpdate(
    correctChange(classId, line.student.id)
  );
  const [isOpen, setIsOpen] = useState(false);
  const [opening, setOpening] = useState(0);
  const [, startTransition] = useTransition();

  const save = (typed: string) => {
    const next = Option.flatMap(Num.parse(typed), decodeValue);
    if (Option.isNone(next)) {
      return;
    }
    startTransition(() =>
      saveSchool(() => correct({ gradeId, slug, value: next.value }), SOURCE)
    );
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpening((count) => count + 1);
          setIsOpen(true);
        }}
        type="button"
        variant="outline"
      >
        <HugeIcons icon={PencilEdit02Icon} />
        {t("correct")}
      </Button>
      {opening === 0 ? null : (
        <LineDialog
          action={t("correct")}
          description={t("correct-description")}
          initial={String(value)}
          isValid={(typed) =>
            Option.isSome(Option.flatMap(Num.parse(typed), decodeValue))
          }
          key={opening}
          label={t("value-label", { name: line.student.name })}
          onSave={save}
          open={isOpen}
          placeholder={t("value-placeholder")}
          setOpen={setIsOpen}
          title={t("correct")}
        />
      )}
    </>
  );
}

/** The row menu of a draft: release it, which shows it to its student. Other lines have no menu. */
function GradeLineMenu({ line }: { line: SheetLine }) {
  const t = useTranslations("SchoolGrades");
  const { classId, slug } = useGradebook();
  const release = useMutation(records.grades.release).withOptimisticUpdate(
    releaseChange(classId, line.student.id)
  );
  const [, startTransition] = useTransition();
  const { grade } = line;
  if (grade === null || grade.state !== "draft") {
    return <RowCopy value={line.student.name} />;
  }
  return (
    <RowItems>
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
    </RowItems>
  );
}
