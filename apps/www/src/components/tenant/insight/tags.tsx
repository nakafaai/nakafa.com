import type { GenericId } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Tag01Icon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import insight from "@repo/backend/confect/_generated/refs/insight";
import {
  Competency,
  QuestionTag as TagView,
} from "@repo/backend/confect/insight/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { HeaderLabel } from "@/components/shared/breadcrumb/frame";
import { useTenant } from "@/components/tenant/context";
import { saveSchool } from "@/components/tenant/settings/save";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/insight/tags";

/** How many exams the dialog offers. */
const EXAM_PAGE = 50;

/** Decodes a typed competency, when it is one. */
const decodeCompetency = Schema.decodeOption(Competency);

/** The questions the dialog shows, with the exam they belong to. */
const ShownTags = Schema.Struct({
  examId: Id("exams"),
  tags: Schema.Array(TagView),
});

/**
 * The button and the dialog that name what each question of an exam tests, the newest exam first. Each field saves when
 * it is left, so Done only closes. With no exam to name, the dialog says so and its footer goes to the exams. The first
 * sign of intent reads the exams and the first exam's questions, and those reads stay for the life of the page, so the
 * dialog opens whole and leaves whole. A press that comes first holds the dialog unseen until they arrive. A chosen exam
 * keeps the fields of the last one until its own are read, so the body never blanks.
 */
export function QuestionTags() {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const id = useId();
  const [open, setOpen] = useState(false);
  const { chosen, hasNoExam, items, setIsWanted, setPicked, shown } =
    useExamTags();

  return (
    <>
      <Button
        onClick={() => {
          setIsWanted(true);
          setOpen(true);
        }}
        onFocus={() => setIsWanted(true)}
        onPointerEnter={() => setIsWanted(true)}
        type="button"
      >
        <HugeIcons icon={Tag01Icon} />
        <HeaderLabel>{t("tags")}</HeaderLabel>
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
        ) : null}
        {!hasNoExam && shown === null ? <PopupHold /> : null}
        {!hasNoExam && shown !== null ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-exam`}>{t("exam")}</FieldLabel>
              <Select
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
            {Arr.isReadonlyArrayEmpty(shown.tags) ? (
              <p className="text-muted-foreground text-sm">{t("tags-none")}</p>
            ) : (
              Arr.map(shown.tags, (tag) => (
                <QuestionTag examId={shown.examId} key={tag.id} tag={tag} />
              ))
            )}
          </FieldGroup>
        ) : null}
      </ResponsiveDialog>
    </>
  );
}

/** Reads the exams once they are wanted and the questions of the chosen exam, which stay shown until the next exam's arrive. */
function useExamTags() {
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const [isWanted, setIsWanted] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [shown, setShown] = useState<typeof ShownTags.Type | null>(null);
  const list = useQuery(
    exams.exams.list,
    isWanted && isSettled
      ? { paginationOpts: { cursor: null, numItems: EXAM_PAGE }, slug }
      : "skip"
  );
  const held = QueryResult.isSuccess(list) ? list.value.page : [];
  const chosen = Option.orElse(
    Arr.findFirst(held, (exam) => exam.id === picked),
    () => Arr.head(held)
  );
  const tags = useQuery(
    insight.tags.list,
    Option.isSome(chosen) ? { examId: chosen.value.id, slug } : "skip"
  );
  if (
    Option.isSome(chosen) &&
    QueryResult.isSuccess(tags) &&
    tags.value !== shown?.tags
  ) {
    setShown({ examId: chosen.value.id, tags: tags.value });
  }

  return {
    chosen,
    hasNoExam: QueryResult.isSuccess(list) && Arr.isReadonlyArrayEmpty(held),
    items: Arr.map(held, (exam) => ({ label: exam.title, value: exam.id })),
    setIsWanted,
    setPicked,
    shown,
  };
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
