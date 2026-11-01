import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent, PageFrame } from "@/components/shared/content/frame";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { OwnPractice } from "@/components/tenant/insight/practice";
import { percentOf } from "@/components/tenant/insight/rows";
import { ClassInsightTable } from "@/components/tenant/insight/table";
import { Link } from "@/lib/routing/link";

/**
 * Insight (ADR 0035): a student reads their own standing, and a teacher reads each student's standing in a class, from
 * the exams whose results were released.
 */
export function SchoolInsight() {
  const { role } = useTenant();

  return Option.contains(role, "student") ? (
    <StudentInsight />
  ) : (
    <TeacherInsight />
  );
}

/** A student's page: their standing, and the practice they choose to share. */
function StudentInsight() {
  const t = useTranslations("SchoolInsight");

  return (
    <PageFrame width="column">
      <SchoolHeader items={[{ label: t("title") }]} />
      <LayoutContent className="flex w-full flex-col gap-4 py-6">
        <OwnInsight />
        <OwnPractice />
      </LayoutContent>
    </PageFrame>
  );
}

/**
 * A teacher's page: the header chooses the class, the first one from the start, so the page opens on a real reading. With
 * no class, the page says what must happen first instead of offering an empty list.
 */
function TeacherInsight() {
  const t = useTranslations("SchoolInsight");
  const classes = useMyClasses();
  const [picked, setPicked] = useState<string | null>(null);
  const held = QueryResult.isSuccess(classes) ? classes.value : [];
  const items = Arr.map(held, (klass) => ({
    label: klass.name,
    value: klass.id,
  }));
  const chosen = Option.orElse(
    Arr.findFirst(held, (klass) => klass.id === picked),
    () => Arr.head(held)
  );

  return (
    <PageFrame width="column">
      <SchoolHeader items={[{ label: t("title") }]}>
        {Option.isSome(chosen) ? (
          <Select
            items={items}
            onValueChange={(value) => setPicked(value)}
            value={chosen.value.id}
          >
            <SelectTrigger aria-label={t("class")} className="w-40 sm:w-56">
              <SelectValue placeholder={t("class")} />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(items, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-4 py-6">
        {Option.isSome(chosen) ? (
          <ClassInsightTable classId={chosen.value.id} />
        ) : null}
        {QueryResult.isSuccess(classes) && Arr.isReadonlyArrayEmpty(held) ? (
          <NoClass />
        ) : null}
      </LayoutContent>
    </PageFrame>
  );
}

/** What a viewer with no class does first: an admin opens the classrooms, and a teacher asks one. */
function NoClass() {
  const t = useTranslations("SchoolInsight");
  const { canManage, slug } = useTenant();

  return (
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
      description={canManage ? t("no-class-description") : t("no-class-member")}
      title={t("no-class")}
    />
  );
}

/** The columns of a student's own standing. */
const skillColumns =
  tableColumns<Ref.Returns<typeof insight.reads.mine>[number]>();

/** A student's own standing in each competency, without a chance. */
function OwnInsight() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const mine = useQuery(insight.reads.mine, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(mine)) {
    throw mine.error;
  }
  if (!QueryResult.isSuccess(mine)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(mine.value)) {
    return (
      <TableEmpty
        act="waving"
        description={t("empty-description")}
        title={t("empty")}
      />
    );
  }
  return (
    <TableFiltersProvider>
      <TableFrame>
        <DataTable
          columns={[
            skillColumns.text((skill) => skill.competency, {
              cell: (info) => <span dir="auto">{info.getValue()}</span>,
              header: t("competency"),
              id: "competency",
            }),
            skillColumns.number((skill) => percentOf(skill.rating), {
              header: t("mastery"),
              id: "mastery",
            }),
            skillColumns.number((skill) => skill.earned, {
              cell: (info) =>
                t("evidence-points", {
                  earned: info.getValue(),
                  possible: info.row.original.possible,
                }),
              header: t("evidence"),
              id: "evidence",
            }),
          ]}
          data={mine.value}
          rowId={(skill) => skill.competency}
        />
      </TableFrame>
    </TableFiltersProvider>
  );
}
