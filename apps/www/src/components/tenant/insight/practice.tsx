import { QueryResult, useMutation, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { columnAlign } from "@/components/shared/table/align";
import { TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import {
  type InsightStudent,
  type OwnTopic,
  practiceRowsOf,
  scoreOf,
  topicNameOf,
} from "@/components/tenant/insight/rows";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/insight/practice";

/** The practice a class's students share with their teachers, and nothing where none does. */
export function SharedPractice({
  students,
}: {
  students: readonly InsightStudent[];
}) {
  const t = useTranslations("SchoolInsight");
  const rows = practiceRowsOf(students);

  if (Arr.isReadonlyArrayEmpty(rows)) {
    return null;
  }
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("student")}
            </TableHead>
            <TableHead className={columnAlign({ align: "start" })}>
              {t("practice")}
            </TableHead>
            <TableHead className={columnAlign()}>
              {t("practice-sets")}
            </TableHead>
            <TableHead className={columnAlign()}>
              {t("practice-mean")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(rows, (row) => (
            <TableRow key={row.key}>
              <TableCell className={columnAlign({ align: "start" })} dir="auto">
                {row.student}
              </TableCell>
              <TableCell className={columnAlign({ align: "start" })}>
                <span className="uppercase">{topicNameOf(row)}</span>
              </TableCell>
              <TableCell className={columnAlign()}>{row.sets}</TableCell>
              <TableCell className={columnAlign()}>
                {scoreOf(row.mean)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/** A student's own practice by topic, each with a switch that shares it with their school, and nothing with no practice. */
export function OwnPractice() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const topics = useQuery(
    insight.practice.topics,
    isSettled ? { slug } : "skip"
  );

  if (QueryResult.isFailure(topics)) {
    throw topics.error;
  }
  if (
    !QueryResult.isSuccess(topics) ||
    Arr.isReadonlyArrayEmpty(topics.value)
  ) {
    return null;
  }
  return (
    <>
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={columnAlign({ align: "start" })}>
                {t("practice")}
              </TableHead>
              <TableHead className={columnAlign()}>
                {t("practice-sets")}
              </TableHead>
              <TableHead className={columnAlign()}>
                {t("practice-mean")}
              </TableHead>
              <TableHead className={columnAlign()}>
                {t("practice-shared")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(topics.value, (topic) => (
              <OwnTopicRow key={topicNameOf(topic)} topic={topic} />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      <p className="text-muted-foreground text-sm">{t("practice-note")}</p>
    </>
  );
}

/** One topic of a student's practice. Its switch moves at once, and a refused change moves it back. */
function OwnTopicRow({ topic }: { topic: OwnTopic }) {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const share = useMutation(insight.practice.share);
  const stop = useMutation(insight.practice.stop);
  const [shared, setShared] = useOptimistic(topic.shared);
  const [, startSaving] = useTransition();
  const names = {
    countryKey: topic.countryKey,
    examKey: topic.examKey,
    slug,
    trackKey: topic.trackKey,
  };

  return (
    <TableRow>
      <TableCell className={columnAlign({ align: "start" })}>
        <span className="uppercase">{topicNameOf(topic)}</span>
      </TableCell>
      <TableCell className={columnAlign()}>{topic.sets}</TableCell>
      <TableCell className={columnAlign()}>{scoreOf(topic.mean)}</TableCell>
      <TableCell className={columnAlign()}>
        <Switch
          aria-label={t("practice-share", { topic: topicNameOf(topic) })}
          checked={shared}
          onCheckedChange={(next) =>
            startSaving(async () => {
              setShared(next);
              await saveSchool(
                () => (next ? share(names) : stop(names)),
                SOURCE
              );
            })
          }
        />
      </TableCell>
    </TableRow>
  );
}
