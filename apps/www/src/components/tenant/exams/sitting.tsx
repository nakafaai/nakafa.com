import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Building03Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  questionGap,
  type ScheduleGap,
} from "@repo/backend/confect/exams/parts";
import type { QuestionTemplate } from "@repo/backend/confect/exams/question";
import type {
  QuestionsUnready,
  ScheduleInvalid,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  RoomName,
  type SittingGroup,
} from "@repo/backend/confect/exams/sittings/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { DateTimePicker } from "@repo/design-system/components/ui/date";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
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
import { useNavigate } from "@tanstack/react-router";
import {
  Array as Arr,
  DateTime,
  Effect,
  Function as Fn,
  Match,
  Option,
  Schema,
  String as Str,
} from "effect";
import { useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { runExamAction, sentAction } from "@/components/tenant/exams/action";
import type { ViewerUnit } from "@/components/tenant/exams/create";
import { useExam } from "@/components/tenant/exams/provider";
import { SITTING_LENGTHS, sittingTimes } from "@/components/tenant/exams/time";

/** The length that a dialog opens with, in minutes. */
const DEFAULT_MINUTES = 60;

/** The audience that stands for the whole unit, beside the cohorts of the unit. */
const UNIT_AUDIENCE = "unit";

/**
 * The sentence that names a question whose key is missing, in the words of its template: a choice,
 * a set of choices, true or false and cause and effect take their correct answer, a short answer an
 * accepted answer, a numeric answer its number, a matching its pairs, and a true or false table a mark for every statement.
 */
const keyNotice = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("short", () => "schedule-key-short" as const),
    Match.when("numeric", () => "schedule-key-numeric" as const),
    Match.when("match", () => "schedule-key-match" as const),
    Match.when("table", () => "schedule-key-table" as const),
    Match.when("reason", () => "schedule-key-reason" as const),
    Match.orElse(() => "schedule-key-choice" as const)
  );

/**
 * The sentence that names a question with a part that shows nothing, in the words of its template: the
 * options of a choice, which the teacher writes or removes, the fixed options of true or false and cause
 * and effect, which the teacher writes, the statements and answers of a matching, and the statements and
 * columns of a true or false table.
 */
const emptyNotice = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("truefalse", () => "schedule-empty-fixed" as const),
    Match.when("cause", () => "schedule-empty-fixed" as const),
    Match.when("match", () => "schedule-empty-match" as const),
    Match.when("table", () => "schedule-empty-table" as const),
    Match.orElse(() => "schedule-empty-choice" as const)
  );

/** The sentence that names what keeps a question from being scheduled. */
const gapNotice = (gap: ScheduleGap, template: QuestionTemplate) =>
  Match.value(gap).pipe(
    Match.when("empty", () => emptyNotice(template)),
    Match.when("key", () => keyNotice(template)),
    Match.when("prompt", () => "schedule-prompt" as const),
    Match.exhaustive
  );

/**
 * The dialog that schedules one sitting of the exam: its unit, its room, its start, and its
 * length. The start is read on the clock of the chosen unit, and it stays as the dialog opened
 * with it when the teacher picks another unit. A refused schedule keeps the dialog open with
 * what the teacher entered.
 */
export function ScheduleSitting({
  onStartsChange,
  starts,
  units,
}: {
  readonly onStartsChange: (starts: string) => void;
  readonly starts: string;
  readonly units: readonly ViewerUnit[];
}) {
  const t = useTranslations("Exams");
  const id = useId();
  const common = useTranslations("Common");
  const navigate = useNavigate();
  const { exam, slug } = useExam();
  const schedule = useMutation(exams.exams.schedule);
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [room, setRoom] = useState("");
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [audience, setAudience] = useState(UNIT_AUDIENCE);
  // The questions the server named as not ready, with their gaps, when the dialog's view of them was behind.
  const [refused, setRefused] = useState<QuestionsUnready["questions"]>([]);
  const [pastStart, setPastStart] = useState(false);
  const [pending, startTransition] = useTransition();
  const unitItems = Arr.map(units, (unit) => ({
    label: unit.name,
    value: unit.id,
  }));
  const lengthItems = Arr.map(SITTING_LENGTHS, (length) => ({
    label: t("length-minutes", { count: length }),
    value: `${length}`,
  }));
  const choice = Option.orElse(
    Arr.findFirst(units, (unit) => unit.id === picked),
    () => Arr.head(units)
  );
  const cohortList = useQuery(
    exams.exams.cohorts,
    Option.isSome(choice) ? { slug, unitId: choice.value.id } : "skip"
  );
  if (QueryResult.isFailure(cohortList)) {
    throw cohortList.error;
  }
  const cohorts = QueryResult.isSuccess(cohortList) ? cohortList.value : [];
  const audienceItems = [
    { label: t("audience-unit"), value: UNIT_AUDIENCE },
    ...Arr.map(cohorts, (cohort) => ({
      label: cohort.name,
      value: cohort.id,
    })),
  ];
  const zone = Option.flatMap(choice, (unit) =>
    DateTime.zoneMakeNamed(unit.timeZone)
  );
  const times = Option.flatMap(zone, (named) =>
    sittingTimes(starts, minutes, named)
  );
  const roomName = Str.trim(room);
  // Each question that keeps the exam from being scheduled, by its number, with its gap (`questionGap`), the
  // rule the server applies: no part that shows nothing, and a key that fits for every template but an essay.
  const unready = Arr.getSomes(
    Arr.map(exam.questions, (question, index) =>
      Option.map(questionGap(question), (gap) => ({
        gap,
        number: index + 1,
        template: question.template,
      }))
    )
  );
  const firstUnready = Arr.head(unready);
  const ready =
    Option.isSome(choice) &&
    Option.isSome(times) &&
    Schema.is(RoomName)(roomName) &&
    Option.isNone(firstUnready) &&
    !pending;

  /** The server refused the schedule because a question is not ready: the footer names the first one. */
  const refuseUnready = (error: QuestionsUnready) =>
    Effect.sync(() => {
      setRefused(error.questions);
    });

  /**
   * The server refused the start. A start that has passed shows under the start. Any other refusal of
   * the start fails on, to the action-error toast.
   */
  const refuseStart = (error: ScheduleInvalid) =>
    error.reason === "opensAt"
      ? Effect.sync(() => {
          setPastStart(true);
        })
      : Effect.fail(error);

  /**
   * Schedules the sitting. The dialog stays open, with its Schedule button off, until the server
   * answers: a saved sitting closes the dialog and opens the exam's rooms, where the room shows,
   * and a refused one keeps what the teacher entered and says why. Any other failure shows the
   * action-error toast.
   */
  const submit = () => {
    if (!ready || Option.isNone(choice) || Option.isNone(times)) {
      return;
    }
    const { closesAt, opensAt } = times.value;
    const unitId = choice.value.id;
    const group: typeof SittingGroup.Type = Option.match(
      Arr.findFirst(cohorts, (cohort) => cohort.id === audience),
      {
        onNone: () => ({ kind: "unit", unitId }),
        onSome: (cohort) => ({ cohortId: cohort.id, kind: "cohort" }),
      }
    );
    setRefused([]);
    setPastStart(false);
    startTransition(async () => {
      await runExamAction(
        sentAction(() =>
          schedule({
            closesAt,
            examId: exam.id,
            group,
            opensAt,
            room: roomName,
            slug,
          })
        ).pipe(
          Effect.tap(() =>
            Effect.sync(() => {
              setOpen(false);
              navigate({
                params: { exam: exam.id, slug },
                to: "/school/$slug/exams/$exam",
              });
            })
          ),
          Effect.catchTags({
            QuestionsUnready: refuseUnready,
            ScheduleInvalid: refuseStart,
          })
        ),
        { onFailure: Fn.constVoid, onSuccess: Fn.constVoid }
      );
    });
  };

  return (
    <ResponsiveDialog
      description={t("schedule-description")}
      footer={
        <>
          <ScheduleNotices
            missing={Option.orElse(firstUnready, () =>
              Option.flatMap(Arr.head(refused), (entry) =>
                Option.map(
                  Arr.get(exam.questions, entry.number - 1),
                  (question) => ({ ...entry, template: question.template })
                )
              )
            )}
            roomMissing={!Schema.is(RoomName)(roomName)}
          />
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={!ready} onClick={submit}>
            {t("schedule")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("schedule-title")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-unit`}>{t("unit")}</FieldLabel>
          <Select
            items={unitItems}
            onValueChange={(key) => {
              setPicked(key);
              setAudience(UNIT_AUDIENCE);
            }}
            value={Option.getOrNull(Option.map(choice, (unit) => unit.id))}
          >
            <SelectTrigger className="w-full" id={`${id}-unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(unitItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-audience`}>{t("audience")}</FieldLabel>
          <Select
            disabled={!Arr.isReadonlyArrayNonEmpty(cohorts)}
            items={audienceItems}
            onValueChange={(key) => setAudience(key ?? UNIT_AUDIENCE)}
            value={audience}
          >
            <SelectTrigger className="w-full" id={`${id}-audience`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(audienceItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  <HugeIcons
                    icon={
                      item.value === UNIT_AUDIENCE
                        ? Building03Icon
                        : UserMultiple02Icon
                    }
                  />
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {Arr.isReadonlyArrayNonEmpty(cohorts) ? null : (
            <FieldDescription>{t("audience-no-cohort")}</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-room`}>{t("room")}</FieldLabel>
          <Input
            id={`${id}-room`}
            onChange={(event) => setRoom(event.target.value)}
            placeholder={t("room-placeholder")}
            value={room}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-starts`}>{t("starts")}</FieldLabel>
          <DateTimePicker
            dayPlaceholder={t("starts-day-placeholder")}
            id={`${id}-starts`}
            onValueChange={(value) => {
              setPastStart(false);
              onStartsChange(value);
            }}
            timePlaceholder={t("starts-time-placeholder")}
            value={starts}
          />
          <FieldDescription>
            {Option.match(choice, {
              onNone: () => t("starts-needed"),
              onSome: (unit) => unit.timeZone,
            })}
          </FieldDescription>
          <FieldError>{pastStart ? t("schedule-past") : null}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-length`}>{t("length")}</FieldLabel>
          <Select
            items={lengthItems}
            onValueChange={(value) => {
              const next = Arr.findFirst(
                SITTING_LENGTHS,
                (length) => `${length}` === value
              );
              if (Option.isSome(next)) {
                setMinutes(next.value);
              }
            }}
            value={`${minutes}`}
          >
            <SelectTrigger className="w-full" id={`${id}-length`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Arr.map(lengthItems, (item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

/**
 * The sentence at the foot of the dialog that names the first question that is not ready, an empty part or a
 * missing key, in the words of its template, one line in the destructive colour. It comes from the exam itself, so it stays put while the
 * dialog is open; a start that has passed shows under the start instead.
 */
function ScheduleNotices({
  missing,
  roomMissing,
}: {
  readonly missing: Option.Option<{
    readonly gap: ScheduleGap;
    readonly number: number;
    readonly template: QuestionTemplate;
  }>;
  /** Whether Schedule waits on the room's name, which an untouched form also does, so it reads as a hint. */
  readonly roomMissing: boolean;
}) {
  const t = useTranslations("Exams");

  return Option.match(missing, {
    onNone: () =>
      roomMissing ? (
        <p className="text-muted-foreground me-auto text-sm">
          {t("schedule-room")}
        </p>
      ) : null,
    onSome: (entry) => (
      <p className="text-destructive me-auto text-sm">
        {t(gapNotice(entry.gap, entry.template), { number: entry.number })}
      </p>
    ),
  });
}
