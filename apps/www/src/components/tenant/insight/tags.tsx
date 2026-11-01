import type { GenericId } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Competency } from "@repo/backend/confect/insight/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option, Schema } from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/insight/tags";

/** How many exams the dialog offers. */
const EXAM_PAGE = 50;

/** Decodes a typed competency, when it is one. */
const decodeCompetency = Schema.decodeOption(Competency);

/**
 * The button and the dialog that name what each question of an exam tests, the newest exam first. Each field saves when
 * it is left, so Done only closes. With no exam to name, the dialog says so and its footer goes to the exams.
 */
export function QuestionTags() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const list = useQuery(
    exams.exams.list,
    open && isSettled
      ? { paginationOpts: { cursor: null, numItems: EXAM_PAGE }, slug }
      : "skip"
  );
  const held = QueryResult.isSuccess(list) ? list.value.page : [];
  const items = Arr.map(held, (exam) => ({
    label: exam.title,
    value: exam.id,
  }));
  const chosen = Option.orElse(
    Arr.findFirst(held, (exam) => exam.id === picked),
    () => Arr.head(held)
  );
  const hasNoExam =
    QueryResult.isSuccess(list) && Arr.isReadonlyArrayEmpty(held);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        {t("tags")}
      </Button>
      <ResponsiveDialog
        description={t("tags-description")}
        footer={
          hasNoExam ? (
            <Link
              className={buttonVariants()}
              params={{ slug }}
              to="/school/$slug/exams"
            >
              {t("exams-action")}
            </Link>
          ) : (
            <Button onClick={() => setOpen(false)} type="button">
              {t("tags-done")}
            </Button>
          )
        }
        open={open}
        setOpen={setOpen}
        title={t("tags")}
      >
        {hasNoExam ? (
          <p className="text-muted-foreground text-sm">{t("tags-empty")}</p>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-exam`}>{t("exam")}</FieldLabel>
              <Select
                disabled={!QueryResult.isSuccess(list)}
                items={items}
                onValueChange={(value) => setPicked(value)}
                value={Option.getOrNull(Option.map(chosen, (exam) => exam.id))}
              >
                <SelectTrigger className="w-full" id={`${id}-exam`}>
                  <SelectValue placeholder={t("exam-placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {Arr.map(items, (item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {Option.isSome(chosen) ? (
              <ExamTags examId={chosen.value.id} key={chosen.value.id} />
            ) : null}
          </FieldGroup>
        )}
      </ResponsiveDialog>
    </>
  );
}

/** One field for each question of the exam, or a sentence when it has none. */
function ExamTags({ examId }: { examId: GenericId.GenericId<"exams"> }) {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const tags = useQuery(insight.tags.list, { examId, slug });

  if (!QueryResult.isSuccess(tags)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(tags.value)) {
    return <p className="text-muted-foreground text-sm">{t("tags-none")}</p>;
  }
  return Arr.map(tags.value, (tag) => (
    <QuestionTag examId={examId} key={tag.id} tag={tag} />
  ));
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
  const id = useId();
  const [text, setText] = useState(tag.competency ?? "");
  const [, startSaving] = useTransition();

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {t("question", { number: tag.number })}
      </FieldLabel>
      <Input
        id={id}
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
        placeholder={t("question-placeholder")}
        value={text}
      />
    </Field>
  );
}
