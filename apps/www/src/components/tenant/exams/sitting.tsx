import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Building03Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  keyMissing,
  type QuestionTemplate,
} from "@repo/backend/confect/exams/question";
import type {
  KeysMissing,
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
import { sittingTimes } from "@/components/tenant/exams/time";

/** The lengths of a sitting in minutes, which the dialog offers. */
const LENGTHS: readonly number[] = [30, 45, 60, 90, 120];

/** The length that a dialog opens with, in minutes. */
const DEFAULT_MINUTES = 60;

/** The audience that stands for the whole unit, beside the cohorts of the unit. */
const UNIT_AUDIENCE = "unit";

/**
 * The sentence that names a question whose key is missing, in the words of its template: a choice,
 * a set of choices, true or false and cause and effect take their correct answer, a short answer an
 * accepted answer, a matching its pairs, and a true or false table a mark for every statement.
 */
const keyNotice = (template: QuestionTemplate) =>
  Match.value(template).pipe(
    Match.when("short", () => "schedule-key-short" as const),
    Match.when("match", () => "schedule-key-match" as const),
    Match.when("table", () => "schedule-key-table" as const),
    Match.orElse(() => "schedule-key-choice" as const)
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
  // The questions the server named as missing their key, when the dialog's view of them was behind.
  const [refusedKeys, setRefusedKeys] = useState<readonly number[]>([]);
  const [pastStart, setPastStart] = useState(false);
  const [pending, startTransition] = useTransition();
  const unitItems = Arr.map(units, (unit) => ({
    label: unit.name,
    value: unit.id,
  }));
  const lengthItems = Arr.map(LENGTHS, (length) => ({
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
  // Each question by its number, and whether it keeps the exam from being scheduled (`keyMissing`), the
  // rule the server applies: an essay needs no key, and every other template a key that fits it.
  const numbered = Arr.map(exam.questions, (question, index) => ({
    missing: keyMissing(question),
    number: index + 1,
    template: question.template,
  }));
  const unkeyed = Arr.findFirst(numbered, (entry) => entry.missing);
  const keysMissing = Option.isSome(unkeyed);
  const ready =
    Option.isSome(choice) &&
    Option.isSome(times) &&
    Schema.is(RoomName)(roomName) &&
    !keysMissing &&
    !pending;

  /** The server refused the schedule because a question has no key that fits it: the footer names the first one. */
  const refuseKeys = (error: KeysMissing) =>
    Effect.sync(() => {
      setRefusedKeys(error.questions);
    });

  /**
   * The server refused the start. A start that has passed stays in the body. Any other refusal of
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
    setRefusedKeys([]);
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
            KeysMissing: refuseKeys,
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
            missing={Option.orElse(unkeyed, () =>
              Option.flatMap(Arr.head(refusedKeys), (number) =>
                Arr.get(numbered, number - 1)
              )
            )}
            pastStart={pastStart}
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
        {Arr.isReadonlyArrayNonEmpty(cohorts) ? (
          <Field>
            <FieldLabel htmlFor={`${id}-audience`}>{t("audience")}</FieldLabel>
            <Select
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
          </Field>
        ) : null}
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
            onValueChange={onStartsChange}
            timePlaceholder={t("starts-time-placeholder")}
            value={starts}
          />
          {Option.isSome(choice) && Option.isSome(times) ? (
            <FieldDescription>{choice.value.timeZone}</FieldDescription>
          ) : (
            <FieldDescription>{t("starts-needed")}</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-length`}>{t("length")}</FieldLabel>
          <Select
            items={lengthItems}
            onValueChange={(value) => {
              const next = Arr.findFirst(
                LENGTHS,
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
 * The sentence at the foot of the dialog that says why the schedule is not made yet, one line in the
 * destructive colour: the first question that still needs its key, in the words of its template, or a
 * start that has passed.
 */
function ScheduleNotices({
  missing,
  pastStart,
}: {
  readonly missing: Option.Option<{
    readonly number: number;
    readonly template: QuestionTemplate;
  }>;
  readonly pastStart: boolean;
}) {
  const t = useTranslations("Exams");

  return (
    <>
      {Option.match(missing, {
        onNone: () => null,
        onSome: (entry) => (
          <p className="me-auto text-destructive text-sm">
            {t(keyNotice(entry.template), { number: entry.number })}
          </p>
        ),
      })}
      {pastStart ? (
        <p className="me-auto text-destructive text-sm">{t("schedule-past")}</p>
      ) : null}
    </>
  );
}
