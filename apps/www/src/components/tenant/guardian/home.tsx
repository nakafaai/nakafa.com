import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  Building03Icon,
  ChartBarLineIcon,
  CheckmarkBadge01Icon,
  IdentityCardIcon,
  MailSend01Icon,
  StudentIcon,
  UserRemove01Icon,
  ViewIcon,
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
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { PageList } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import {
  PaneBody,
  PaneFill,
  PaneFooter,
  PaneHeader,
  PaneOpen,
} from "@/components/shared/page/pane";
import {
  PagePane,
  Panes,
  PanesList,
  PanesProvider,
  usePanes,
} from "@/components/shared/page/panes";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { RowItems, RowOpen } from "@/components/shared/table/menu";
import { TableStatus } from "@/components/shared/table/status";
import { TableText } from "@/components/shared/table/text";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { TableViews } from "@/components/shared/table/views";
import { EmptyState } from "@/components/state/empty";
import { LoadFailure } from "@/components/state/failure";
import { EmptyNina } from "@/components/state/nina";
import { useTenant } from "@/components/tenant/context";
import {
  type ChildItem,
  withdrawChange,
} from "@/components/tenant/guardian/change";
import { GuardianGrades } from "@/components/tenant/guardian/grades";
import {
  AskDialog,
  ParentRequests,
} from "@/components/tenant/guardian/requests";
import { LINK_STATUS_LOOKS } from "@/components/tenant/guardian/status";
import { SchoolHeader } from "@/components/tenant/header";
import { isLostAccess } from "@/components/tenant/refusal";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

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
  const children = useChildren();

  if (QueryResult.isFailure(children) && isLostAccess(children.error)) {
    throw children.error;
  }

  return (
    <TableFiltersProvider>
      <PanesProvider>
        <Page height="screen">
          <SchoolHeader
            items={[{ label: t("home-title") }]}
            title={t("home-title")}
          />
          <Panes id="guardian">
            <PanesList>
              <PageList>
                {QueryResult.isFailure(children) ? (
                  <LoadFailure onRetry={reloadPage} />
                ) : null}
                {QueryResult.isSuccess(children) ? <GuardianChildren /> : null}
              </PageList>
            </PanesList>
            {QueryResult.isSuccess(children) ? (
              <PagePane label={t("child-detail")}>
                <GuardianChild items={children.value} />
              </PagePane>
            ) : null}
          </Panes>
        </Page>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/** The parent's linked children, which the home and its table read from one subscription. */
function useChildren() {
  const { slug } = useTenant();
  return useQuery(guardians.family.children, { slug });
}

/** The linked children, each opening beside the list, or the empty state under the heads while none is linked. */
function GuardianChildren() {
  const t = useTranslations("SchoolGuardians");
  const common = useTranslations("Common");
  const children = useChildren();

  const columns = [
    childColumns.text((child) => child.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.linkId}>{info.getValue()}</PaneOpen>
      ),
      header: t("child"),
      id: "child",
    }),
    childColumns.text((child) => child.student.email ?? "", {
      cell: (info) => <TableText>{info.getValue()}</TableText>,
      header: t("email"),
      id: "email",
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
    childColumns.values((child) => (child.staffCheck ? "school" : "nisn"), {
      cell: (info) => t(`check-${info.getValue()}`),
      header: t("check"),
      id: "check",
      options: [
        { icon: IdentityCardIcon, label: t("check-nisn"), value: "nisn" },
        { icon: Building03Icon, label: t("check-school"), value: "school" },
      ],
    }),
    childColumns.menu(() => (
      <RowItems>
        <RowOpen icon={ViewIcon} label={common("open")} />
      </RowItems>
    )),
  ];

  return (
    <DataTable
      columns={columns}
      data={QueryResult.isSuccess(children) ? children.value : []}
      empty={
        <EmptyState
          description={t("home-empty-description")}
          scene={<EmptyNina act="waving" />}
          title={t("home-empty")}
        />
      }
      rowId={(child) => child.linkId}
    />
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
          <>
            <PaneBody>
              <p className="text-muted-foreground text-sm">
                {t("child-staff-check")}
              </p>
            </PaneBody>
            <PaneFooter>
              <GuardianWithdraw child={found} />
            </PaneFooter>
          </>
        ) : null}
        {found.status === "verified" ? (
          <GuardianVerified child={found} />
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
      runSchoolWrite(
        schoolCall(() => confirm({ linkId: child.linkId, nisn, slug })),
        { onSaved: (answer) => setRefused(answer === "refused") }
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
        <GuardianWithdraw child={child} />
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

/**
 * A child of a verified link: one list, the released grades or what the parent asked the school, one view at a time,
 * so the pane's body is one table in its card. The footer asks the school while the requests show, and withdraws
 * consent.
 */
function GuardianVerified({ child }: { child: ChildItem }) {
  const t = useTranslations("SchoolGuardians");
  const [view, setView] = useState<"grades" | "requests">("grades");

  return (
    <>
      <TableFiltersProvider>
        <PaneFill
          views={
            <TableViews
              label={t("child-views")}
              onChoose={setView}
              view={view}
              views={[
                {
                  icon: ChartBarLineIcon,
                  label: t("view-grades"),
                  value: "grades",
                },
                {
                  icon: MailSend01Icon,
                  label: t("view-requests"),
                  value: "requests",
                },
              ]}
            />
          }
        >
          {view === "grades" ? (
            <GuardianGrades linkId={child.linkId} />
          ) : (
            <ParentRequests linkId={child.linkId} />
          )}
        </PaneFill>
      </TableFiltersProvider>
      <PaneFooter>
        {view === "requests" ? <AskDialog linkId={child.linkId} /> : null}
        <GuardianWithdraw child={child} />
      </PaneFooter>
    </>
  );
}

/** Ends a child's link, verified or still waiting, once the parent confirms it. */
function GuardianWithdraw({ child }: { child: ChildItem }) {
  const t = useTranslations("SchoolGuardians");
  const { slug } = useTenant();
  const withdraw = useMutation(guardians.family.withdraw).withOptimisticUpdate(
    withdrawChange
  );
  const [, startTransition] = useTransition();
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsWithdrawing(true)}
        type="button"
        variant="destructive"
      >
        <HugeIcons icon={UserRemove01Icon} />
        {t("withdraw")}
      </Button>
      <ResponsiveDialog
        action={
          <Button
            onClick={() => {
              setIsWithdrawing(false);
              startTransition(() =>
                runSchoolWrite(
                  schoolCall(() => withdraw({ linkId: child.linkId, slug }))
                )
              );
            }}
            type="button"
            variant="destructive"
          >
            <HugeIcons icon={UserRemove01Icon} />
            {t("withdraw")}
          </Button>
        }
        description={t("withdraw-description")}
        open={isWithdrawing}
        setOpen={setIsWithdrawing}
        title={t("withdraw-title")}
      >
        <ResponsiveDialogSubject icon={StudentIcon}>
          {child.student.name}
        </ResponsiveDialogSubject>
      </ResponsiveDialog>
    </>
  );
}
