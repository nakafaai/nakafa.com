import { QueryResult, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { columnAlign } from "@/components/shared/table/align";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { percentOf } from "@/components/tenant/insight/rows";
import { ClassInsightTable } from "@/components/tenant/insight/table";
import { QuestionTags } from "@/components/tenant/insight/tags";

/**
 * Insight (ADR 0035): a student reads their own standing, and a teacher picks a class and reads each student's
 * standing with the chance of reaching the KKTP. It stays off until the school records its impact assessment.
 */
export function SchoolInsight() {
  const t = useTranslations("SchoolInsight");
  const { role } = useTenant();

  return (
    <>
      <SchoolHeader items={[{ label: t("title") }]}>
        {Option.contains(role, "student") ? null : <QuestionTags />}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-4 py-6">
        {Option.contains(role, "student") ? <OwnInsight /> : <TeacherInsight />}
      </LayoutContent>
    </>
  );
}

/** The class picker over the class a teacher reads. */
function TeacherInsight() {
  const t = useTranslations("SchoolInsight");
  const classes = useMyClasses();
  const [picked, setPicked] = useState<string | null>(null);
  const items = QueryResult.isSuccess(classes)
    ? Arr.map(classes.value, (klass) => ({
        label: klass.name,
        value: klass.id,
      }))
    : [];
  const chosen = Arr.findFirst(
    QueryResult.isSuccess(classes) ? classes.value : [],
    (klass) => klass.id === picked
  );

  return (
    <>
      <Select
        items={items}
        onValueChange={(value) => setPicked(value)}
        value={picked}
      >
        <SelectTrigger aria-label={t("class")} className="w-full sm:w-64">
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
      {Option.isSome(chosen) ? (
        <ClassInsightTable classId={chosen.value.id} />
      ) : (
        <TableEmpty
          act="waving"
          description={t("pick-description")}
          title={t("pick")}
        />
      )}
    </>
  );
}

/** A student's own standing in each competency, without a chance. */
function OwnInsight() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const mine = useQuery(insight.reads.mine, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(mine) || !QueryResult.isSuccess(mine)) {
    return QueryResult.isFailure(mine) ? <InsightOff /> : null;
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
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("competency")}
            </TableHead>
            <TableHead className={columnAlign()}>{t("mastery")}</TableHead>
            <TableHead className={columnAlign()}>{t("evidence")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(mine.value, (skill) => (
            <TableRow key={skill.competency}>
              <TableCell className={columnAlign({ align: "start" })} dir="auto">
                {skill.competency}
              </TableCell>
              <TableCell className={columnAlign()}>
                {percentOf(skill.rating)}
              </TableCell>
              <TableCell className={columnAlign()}>
                {t("evidence-points", {
                  earned: skill.earned,
                  possible: skill.possible,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/** What Insight shows while the school has recorded no impact assessment. */
export function InsightOff() {
  const t = useTranslations("SchoolInsight");
  return (
    <TableEmpty
      act="waving"
      description={t("off-description")}
      title={t("off")}
    />
  );
}
