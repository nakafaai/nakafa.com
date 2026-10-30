import type { Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  PaneBody,
  PaneFooter,
  PaneHeader,
  PaneOpen,
} from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/panes";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import {
  type ChildItem,
  withdrawChange,
} from "@/components/tenant/guardian/change";
import { LINK_STATUS_LOOKS } from "@/components/tenant/guardian/status";
import { SchoolHeader } from "@/components/tenant/header";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/home";

/** One released grade of a child, as the parent home shows it. */
type ChildGrade = Ref.Returns<typeof guardians.family.grades>[number];

/** The columns of the children table. */
const childColumns = createColumnHelper<typeof dataTableFeatures, ChildItem>();

/**
 * The parent home (ADR 0034): the linked children in a table, and the child a press opens
 * beside it on a wide screen and in a sheet on a phone. A pending link asks for the child's
 * NISN, or says that the school checks it; a verified link shows the child's released grades
 * with the way to withdraw consent; and an ended link says how it ended.
 */
export function GuardianHome() {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const children = useQuery(guardians.family.children, { slug });

  return (
    <TableFiltersProvider>
      <PanesProvider>
        <SchoolHeader
          items={[{ label: t("home-title") }]}
          title={t("home-title")}
        />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          {QueryResult.isSuccess(children) ? (
            <GuardianChildren items={children.value} />
          ) : null}
        </div>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/** The children beside the open child, or the empty state while no child is linked. */
function GuardianChildren({ items }: { items: readonly ChildItem[] }) {
  const t = useTranslations("SchoolGuardians");
  if (Arr.isReadonlyArrayEmpty(items)) {
    return (
      <TableEmpty
        act="waving"
        description={t("home-empty-description")}
        title={t("home-empty")}
      />
    );
  }

  const columns = childColumns.columns([
    childColumns.accessor((child) => child.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.linkId}>{info.getValue()}</PaneOpen>
      ),
      header: t("child"),
      id: "child",
      sortFn: "text",
    }),
    childColumns.accessor((child) => child.status, {
      cell: (info) => (
        <TableStatus
          icon={LINK_STATUS_LOOKS[info.getValue()].icon}
          label={t(`status-${info.getValue()}`)}
          tone={LINK_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      header: t("status"),
      id: "status",
      meta: { align: "center" },
    }),
  ]);

  return (
    <Panes>
      <PanesList>
        <DataTable
          columns={columns}
          data={items}
          rowId={(child) => child.linkId}
          search="child"
        />
      </PanesList>
      <PanesDetail empty={t("child-detail-empty")} label={t("child-detail")}>
        <GuardianChild items={items} />
      </PanesDetail>
    </Panes>
  );
}

/** The open child, by the state of its link. A child the list no longer holds closes. */
function GuardianChild({ items }: { items: readonly ChildItem[] }) {
  const t = useTranslations("SchoolGuardians");
  const open = usePanes((state) => state.open);
  const child = Option.flatMap(open, (id) =>
    Arr.findFirst(items, (candidate) => candidate.linkId === id)
  );

  return Option.match(child, {
    onNone: () => null,
    onSome: (found) => (
      <div className="contents" data-child={found.status}>
        <PaneHeader
          description={t(`child-${found.status}`)}
          title={found.student.name}
        />
        {found.status === "pending" && !found.staffCheck ? (
          <GuardianConfirm child={found} />
        ) : null}
        {found.status === "pending" && found.staffCheck ? (
          <PaneBody>
            <p className="text-muted-foreground text-sm">
              {t("child-staff-check")}
            </p>
          </PaneBody>
        ) : null}
        {found.status === "verified" ? <GuardianGrades child={found} /> : null}
        {found.status !== "pending" && found.status !== "verified" ? (
          <PaneBody>
            <p className="text-muted-foreground text-sm">
              {t("child-ended-hint")}
            </p>
          </PaneBody>
        ) : null}
      </div>
    ),
  });
}

/**
 * The second check of a pending link: the child's NISN. The server compares it with the
 * roster and answers verified or refused; a refusal reads as a wrong code would.
 */
function GuardianConfirm({ child }: { child: ChildItem }) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const id = useId();
  const confirm = useMutation(guardians.family.confirm);
  const [isPending, startTransition] = useTransition();
  const [nisn, setNisn] = useState("");
  const [refused, setRefused] = useState(false);

  const submit = () =>
    startTransition(() =>
      saveSchool(
        () => confirm({ linkId: child.linkId, nisn, slug }),
        SOURCE,
        (answer) => setRefused(answer === "refused")
      )
    );

  return (
    <>
      <PaneBody>
        <Field data-invalid={refused}>
          <FieldLabel htmlFor={`${id}-nisn`}>{t("nisn-label")}</FieldLabel>
          <Input
            aria-describedby={refused ? `${id}-refused` : `${id}-hint`}
            aria-invalid={refused}
            id={`${id}-nisn`}
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => {
              setNisn(event.target.value);
              setRefused(false);
            }}
            placeholder="0012345678"
            value={nisn}
          />
          <FieldDescription id={`${id}-hint`}>
            {t("nisn-hint")}
          </FieldDescription>
          <FieldError id={`${id}-refused`}>
            {refused ? t("nisn-refused") : null}
          </FieldError>
        </Field>
      </PaneBody>
      <PaneFooter>
        <Button
          disabled={nisn.length !== 10 || isPending}
          inert={isPending}
          onClick={submit}
          type="button"
        >
          <HugeIcons icon={CheckmarkBadge01Icon} />
          {t("nisn-submit")}
        </Button>
      </PaneFooter>
    </>
  );
}

/** The released grades of a child of a verified link, and the way to withdraw consent. */
function GuardianGrades({ child }: { child: ChildItem }) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const common = useTranslations("Common");
  const grades = useQuery(guardians.family.grades, {
    linkId: child.linkId,
    slug,
  });
  const withdraw = useMutation(guardians.family.withdraw).withOptimisticUpdate(
    withdrawChange
  );
  const [, startTransition] = useTransition();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  return (
    <>
      <PaneBody>
        {QueryResult.isSuccess(grades) ? (
          <GuardianGradeTable grades={grades.value} />
        ) : null}
      </PaneBody>
      <PaneFooter>
        <Button
          onClick={() => setIsWithdrawing(true)}
          type="button"
          variant="destructive"
        >
          <HugeIcons icon={UserRemove01Icon} />
          {t("withdraw")}
        </Button>
      </PaneFooter>
      <ResponsiveDialog
        description={t("withdraw-description")}
        footer={
          <>
            <Button
              onClick={() => setIsWithdrawing(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              onClick={() => {
                setIsWithdrawing(false);
                startTransition(() =>
                  saveSchool(
                    () => withdraw({ linkId: child.linkId, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
              variant="destructive"
            >
              <HugeIcons icon={UserRemove01Icon} />
              {t("withdraw")}
            </Button>
          </>
        }
        open={isWithdrawing}
        setOpen={setIsWithdrawing}
        title={t("withdraw-title")}
      />
    </>
  );
}

/** The child's released grades in a plain table, or one sentence while none is released. */
function GuardianGradeTable({ grades }: { grades: readonly ChildGrade[] }) {
  const t = useTranslations("SchoolGuardians");
  if (Arr.isReadonlyArrayEmpty(grades)) {
    return <p className="text-muted-foreground text-sm">{t("grades-empty")}</p>;
  }
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("grade-class")}</TableHead>
            <TableHead className="text-end">{t("grade-value")}</TableHead>
            <TableHead>{t("grade-note")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(grades, (grade) => (
            <TableRow key={grade.id}>
              <TableCell dir="auto">{grade.className}</TableCell>
              <TableCell className="text-end tabular-nums">
                {grade.value}
              </TableCell>
              <TableCell>{grade.band ?? t(`kktp-${grade.kktp}`)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}
