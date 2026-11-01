import type { Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import { LinkStatus } from "@repo/backend/confect/guardians/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
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
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { useTenant } from "@/components/tenant/context";
import {
  type ChildItem,
  withdrawChange,
} from "@/components/tenant/guardian/change";
import { ParentRequests } from "@/components/tenant/guardian/requests";
import { LINK_STATUS_LOOKS } from "@/components/tenant/guardian/status";
import { SchoolHeader } from "@/components/tenant/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/guardian/home";

/** One released grade of a child, as the parent home shows it. */
type ChildGrade = Ref.Returns<typeof guardians.family.grades>[number];

/** The columns of the children table. */
const childColumns = tableColumns<ChildItem>();

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

  if (QueryResult.isFailure(children) && isLostAccess(children.error)) {
    throw children.error;
  }

  return (
    <TableFiltersProvider>
      <PanesProvider>
        <SchoolHeader
          items={[{ label: t("home-title") }]}
          title={t("home-title")}
        />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          {QueryResult.isFailure(children) ? (
            <LoadFailure onRetry={reloadPage} />
          ) : null}
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

  const columns = [
    childColumns.text((child) => child.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.linkId}>{info.getValue()}</PaneOpen>
      ),
      header: t("child"),
      id: "child",
    }),
    childColumns.values((child) => child.status, {
      cell: (info) => (
        <TableStatus
          icon={LINK_STATUS_LOOKS[info.getValue()].icon}
          label={t(`status-${info.getValue()}`)}
          tone={LINK_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("status"),
      id: "status",
      options: Arr.map(LinkStatus.literals, (status) => ({
        icon: LINK_STATUS_LOOKS[status].icon,
        label: t(`status-${status}`),
        value: status,
      })),
    }),
  ];

  return (
    <Panes>
      <PanesList>
        <DataTable
          columns={columns}
          data={items}
          rowId={(child) => child.linkId}
        />
      </PanesList>
      <PanesDetail label={t("child-detail")}>
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
        {found.status === "verified" ? (
          <>
            <GuardianGrades child={found} />
            <PaneBody>
              <ParentRequests linkId={found.linkId} />
            </PaneBody>
          </>
        ) : null}
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
  const narratives = useQuery(guardians.family.narratives, {
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
        {QueryResult.isFailure(grades) ? (
          <LoadFailure onRetry={reloadPage} />
        ) : null}
        {QueryResult.isSuccess(grades) ? (
          <GuardianGradeTable grades={grades.value} />
        ) : null}
        {QueryResult.isLoading(grades) ? <PopupHold /> : null}
        {QueryResult.isSuccess(narratives)
          ? Arr.map(narratives.value, (narrative) => (
              <div className="flex flex-col gap-1" key={narrative.id}>
                <p className="text-sm font-medium" dir="auto">
                  {narrative.className}
                </p>
                <p className="text-sm whitespace-pre-wrap" dir="auto">
                  {narrative.text}
                </p>
              </div>
            ))
          : null}
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

/** The columns of a child's grades. */
const gradeColumns = tableColumns<ChildGrade>();

/** The child's released grades in a plain table, or one sentence while none is released. */
function GuardianGradeTable({ grades }: { grades: readonly ChildGrade[] }) {
  const t = useTranslations("SchoolGuardians");
  if (Arr.isReadonlyArrayEmpty(grades)) {
    return <p className="text-muted-foreground text-sm">{t("grades-empty")}</p>;
  }
  return (
    <TableFiltersProvider>
      <TableFrame>
        <DataTable
          columns={[
            gradeColumns.text((grade) => grade.className, {
              cell: (info) => <span dir="auto">{info.getValue()}</span>,
              header: t("grade-class"),
              id: "class",
            }),
            gradeColumns.number((grade) => grade.value, {
              header: t("grade-value"),
              id: "value",
            }),
            gradeColumns.text(
              (grade) => grade.band ?? t(`kktp-${grade.kktp}`),
              { header: t("grade-note"), id: "note" }
            ),
          ]}
          data={grades}
          plain
          rowId={(grade) => grade.id}
        />
      </TableFrame>
    </TableFiltersProvider>
  );
}
