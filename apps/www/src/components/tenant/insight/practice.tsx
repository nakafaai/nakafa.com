import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  Share08Icon,
  SquareLock02Icon,
  StudentIcon,
} from "@hugeicons/core-free-icons";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Array as Arr } from "effect";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableNote } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableTitle } from "@/components/shared/table/title";
import { useTenant } from "@/components/tenant/context";
import { NarrativeMenu } from "@/components/tenant/insight/narrative";
import {
  type InsightStudent,
  type OwnTopic,
  practiceRowsOf,
  scoreOf,
  topicNameOf,
} from "@/components/tenant/insight/rows";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/insight/practice";

/** The columns of the practice a class's students share. */
const sharedColumns = tableColumns<ReturnType<typeof practiceRowsOf>[number]>();

/** The columns of a student's own practice. */
const topicColumns = tableColumns<OwnTopic>();

/** The practice a class's students share with their teachers, with each student's narrative one press from the row. */
export function SharedPractice({
  isRead,
  students,
}: {
  isRead: boolean;
  students: readonly InsightStudent[];
}) {
  const t = useTranslations("SchoolInsight");
  const rows = practiceRowsOf(students);

  return (
    <>
      <DataTable
        columns={[
          sharedColumns.text((row) => row.student, {
            cell: (info) => (
              <TableTitle icon={StudentIcon}>
                <span dir="auto">{info.getValue()}</span>
              </TableTitle>
            ),
            header: t("student"),
            id: "student",
          }),
          sharedColumns.text(topicNameOf, {
            cell: (info) => (
              <span className="uppercase">{info.getValue()}</span>
            ),
            header: t("practice"),
            id: "topic",
          }),
          sharedColumns.number((row) => row.sets, {
            header: t("practice-sets"),
            id: "sets",
          }),
          sharedColumns.number((row) => scoreOf(row.mean), {
            header: t("practice-mean"),
            id: "mean",
          }),
          sharedColumns.menu((info) => (
            <NarrativeMenu id={info.row.original.studentId} />
          )),
        ]}
        data={rows}
        empty={
          <TableEmpty
            act="relaxed"
            description={t("practice-class-note")}
            title={t("practice-empty")}
          />
        }
        loading={!isRead}
        rowId={(row) => row.key}
      />
      {Arr.isReadonlyArrayEmpty(rows) ? null : (
        <TableNote>{t("practice-class-note")}</TableNote>
      )}
    </>
  );
}

/** A student's own practice by topic, each with a switch that shares it with their school. */
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
  const isRead = QueryResult.isSuccess(topics);

  return (
    <>
      <DataTable
        columns={[
          topicColumns.text(topicNameOf, {
            cell: (info) => (
              <span className="uppercase">{info.getValue()}</span>
            ),
            header: t("practice"),
            id: "topic",
          }),
          topicColumns.number((topic) => topic.sets, {
            header: t("practice-sets"),
            id: "sets",
          }),
          topicColumns.number((topic) => scoreOf(topic.mean), {
            header: t("practice-mean"),
            id: "mean",
          }),
          topicColumns.values((topic) => (topic.shared ? "on" : "off"), {
            cell: (info) => <OwnTopicShare topic={info.row.original} />,
            header: t("practice-shared"),
            id: "shared",
            options: [
              {
                icon: Share08Icon,
                label: t("practice-shared"),
                value: "on",
              },
              {
                icon: SquareLock02Icon,
                label: t("practice-unshared"),
                value: "off",
              },
            ],
          }),
          topicColumns.menu((info) => (
            <RowCopy value={topicNameOf(info.row.original)} />
          )),
        ]}
        data={isRead ? topics.value : []}
        empty={
          <TableEmpty
            act="relaxed"
            description={t("practice-own-empty-description")}
            title={t("practice-empty")}
          />
        }
        loading={!isRead}
        rowId={topicNameOf}
      />
      {isRead && Arr.isReadonlyArrayNonEmpty(topics.value) ? (
        <TableNote>{t("practice-note")}</TableNote>
      ) : null}
    </>
  );
}

/** The switch of one topic of a student's practice. It moves at once, and a refused change moves it back. */
function OwnTopicShare({ topic }: { topic: OwnTopic }) {
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
    <Switch
      aria-label={t("practice-share", { topic: topicNameOf(topic) })}
      checked={shared}
      onCheckedChange={(next) =>
        startSaving(async () => {
          setShared(next);
          await saveSchool(() => (next ? share(names) : stop(names)), SOURCE);
        })
      }
    />
  );
}
