import type { GenericId } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Competency } from "@repo/backend/confect/insight/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/insight/tags";

/** How many exams the dialog offers. */
const EXAM_PAGE = 50;

/** Decodes a typed competency, when it is one. */
const decodeCompetency = Schema.decodeOption(Competency);

/** The dialog that names the competency of each question of an exam. A question with none adds nothing to Insight. */
export function QuestionTags() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const list = useQuery(
    exams.exams.list,
    open && isSettled
      ? { paginationOpts: { cursor: null, numItems: EXAM_PAGE }, slug }
      : "skip"
  );
  const items = QueryResult.isSuccess(list)
    ? Arr.map(list.value.page, (exam) => ({
        label: exam.title,
        value: exam.id,
      }))
    : [];
  const chosen = Arr.findFirst(
    QueryResult.isSuccess(list) ? list.value.page : [],
    (exam) => exam.id === picked
  );

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        {t("tags")}
      </Button>
      <ResponsiveDialog
        description={t("tags-description")}
        open={open}
        setOpen={setOpen}
        title={t("tags")}
      >
        <Select
          items={items}
          onValueChange={(value) => setPicked(value)}
          value={picked}
        >
          <SelectTrigger aria-label={t("exam")} className="w-full">
            <SelectValue placeholder={t("exam")} />
          </SelectTrigger>
          <SelectContent>
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {Option.isSome(chosen) ? <ExamTags examId={chosen.value.id} /> : null}
      </ResponsiveDialog>
    </>
  );
}

/** One input for each question of the exam. */
function ExamTags({ examId }: { examId: GenericId.GenericId<"exams"> }) {
  const { slug } = useTenant();
  const tags = useQuery(insight.tags.list, { examId, slug });

  if (!QueryResult.isSuccess(tags)) {
    return null;
  }
  return (
    <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
      {Arr.map(tags.value, (tag) => (
        <QuestionTag examId={examId} key={tag.id} tag={tag} />
      ))}
    </div>
  );
}

/** The competency of one question, saved when the field is left. An emptied field takes it away. */
function QuestionTag({
  examId,
  tag,
}: {
  examId: GenericId.GenericId<"exams">;
  tag: {
    competency: string | null;
    id: GenericId.GenericId<"examQuestions">;
    number: number;
  };
}) {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const set = useMutation(insight.tags.set);
  const [text, setText] = useState(tag.competency ?? "");
  const [, startSaving] = useTransition();
  const label = t("question", { number: tag.number });

  return (
    <Input
      aria-label={label}
      onBlur={() => {
        const competency = Option.getOrNull(decodeCompetency(text.trim()));
        if (competency === tag.competency) {
          return;
        }
        startSaving(() =>
          saveSchool(
            () => set({ competency, examId, questionId: tag.id, slug }),
            SOURCE
          )
        );
      }}
      onChange={(event) => setText(event.target.value)}
      placeholder={label}
      value={text}
    />
  );
}
