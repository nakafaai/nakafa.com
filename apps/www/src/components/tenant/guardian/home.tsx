import type { Ref } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import guardians from "@repo/backend/confect/_generated/refs/guardians";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
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
import { Array as Arr } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { LayoutContent } from "@/components/shared/content/frame";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import {
  type ChildItem,
  withdrawChange,
} from "@/components/tenant/guardian/change";
import { SchoolHeader } from "@/components/tenant/header";
import { saveSchool } from "@/components/tenant/settings/save";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

const SOURCE = "components/tenant/guardian/home";

/** One released grade of a child, as the parent home shows it. */
type ChildGrade = Ref.Returns<typeof guardians.family.grades>[number];

/**
 * The parent home (ADR 0034): one card for each linked child. A pending link asks for the
 * child's NISN, or says that the school checks it, a verified link shows the child's released
 * grades with the way to withdraw consent, and an ended link says how it ended.
 */
export function GuardianHome({
  first,
  slug,
}: {
  first: readonly ChildItem[] | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  const children = usePreloadedQueryResult(
    guardians.family.children,
    { slug },
    first
  );

  return (
    <>
      <SchoolHeader
        items={[{ label: t("home-title") }]}
        title={t("home-title")}
      />
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        {QueryResult.isSuccess(children) ? (
          <GuardianChildren items={children.value} slug={slug} />
        ) : null}
      </LayoutContent>
    </>
  );
}

/** The cards of the children, or the empty state while no child is linked. */
function GuardianChildren({
  items,
  slug,
}: {
  items: readonly ChildItem[];
  slug: TenantSlug;
}) {
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
  return Arr.map(items, (child) => (
    <GuardianChildCard child={child} key={child.linkId} slug={slug} />
  ));
}

/** One child's card, by the state of its link. */
function GuardianChildCard({
  child,
  slug,
}: {
  child: ChildItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
  return (
    <CardSection data-slot="guardian-child" data-status={child.status}>
      <CardHeader>
        <CardTitle dir="auto">{child.student.name}</CardTitle>
        <CardDescription>{t(`child-${child.status}`)}</CardDescription>
      </CardHeader>
      {child.status === "pending" && !child.staffCheck ? (
        <GuardianConfirm child={child} slug={slug} />
      ) : null}
      {child.status === "pending" && child.staffCheck ? (
        <CardSectionFooter hint={t("child-staff-check")} />
      ) : null}
      {child.status === "verified" ? (
        <GuardianGrades child={child} slug={slug} />
      ) : null}
      {child.status !== "pending" && child.status !== "verified" ? (
        <CardSectionFooter hint={t("child-ended-hint")} />
      ) : null}
    </CardSection>
  );
}

/**
 * The second check of a pending link: the child's NISN. The server compares it with the
 * roster and answers verified or refused; a refusal reads as a wrong code would.
 */
function GuardianConfirm({
  child,
  slug,
}: {
  child: ChildItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
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
      <CardContent>
        <Field>
          <FieldLabel htmlFor={`${id}-nisn`}>{t("nisn-label")}</FieldLabel>
          <Input
            id={`${id}-nisn`}
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => setNisn(event.target.value)}
            value={nisn}
          />
        </Field>
      </CardContent>
      <CardSectionFooter
        hint={refused ? t("nisn-refused") : t("nisn-hint")}
        tone={refused ? "destructive" : "muted"}
      >
        <CardSectionActions>
          <Button
            disabled={nisn.length !== 10 || isPending}
            inert={isPending}
            onClick={submit}
            size="sm"
            type="button"
          >
            {t("nisn-submit")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </>
  );
}

/** The released grades of a child of a verified link, and the way to withdraw consent. */
function GuardianGrades({
  child,
  slug,
}: {
  child: ChildItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolGuardians");
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
      <CardContent>
        {QueryResult.isSuccess(grades) ? (
          <GuardianGradeTable grades={grades.value} />
        ) : null}
      </CardContent>
      <CardSectionFooter hint={t("withdraw-hint")}>
        <CardSectionActions>
          <Button
            onClick={() => setIsWithdrawing(true)}
            size="sm"
            type="button"
            variant="destructive"
          >
            {t("withdraw")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
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
